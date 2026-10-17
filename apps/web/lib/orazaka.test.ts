import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { BREAKER_FAILURES, BREAKER_OPEN_MS, breakerState, callOrazaka, embedTexts, orazakaConfigured, OrazakaUnavailableError, resetBreaker } from "./orazaka";

const env = { AI_ENGINE_URL: "https://engine.example/edge/", AI_ENGINE_API_KEY: "oz_live_secretkey" };

const answer = (data: number[][], extra: object = {}) =>
  new Response(JSON.stringify({ runId: "run-1", model: "bge-m3", dimensions: data[0]?.length, data: data.map((embedding, index) => ({ index, embedding })), usage: { promptTokens: 7 }, ...extra }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

beforeEach(() => resetBreaker());

describe("the Orazaka client", () => {
  it("is configured only with both the URL and the key", () => {
    expect(orazakaConfigured(env)).toBe(true);
    expect(orazakaConfigured({ AI_ENGINE_URL: env.AI_ENGINE_URL })).toBe(false);
    expect(orazakaConfigured({ AI_ENGINE_API_KEY: env.AI_ENGINE_API_KEY })).toBe(false);
    expect(orazakaConfigured({})).toBe(false);
  });

  it("asks Orazaka's edge for embeddings with the service key and returns the run id", async () => {
    const fetchImpl = vi.fn(async () => answer([[1, 0], [0, 1]]));
    const result = await embedTexts(["a", "b"], { env, fetchImpl: fetchImpl as unknown as typeof fetch });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://engine.example/edge/api/v1/embeddings");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer oz_live_secretkey");
    expect(JSON.parse(init.body as string)).toEqual({ input: ["a", "b"] });
    expect(result).toMatchObject({ runId: "run-1", model: "bge-m3", dimensions: 2, promptTokens: 7, vectors: [[1, 0], [0, 1]] });
  });

  it("orders the vectors by index, whatever order they arrive in", async () => {
    const swapped = new Response(JSON.stringify({ runId: "r", model: "m", data: [{ index: 1, embedding: [2] }, { index: 0, embedding: [1] }] }));
    const result = await embedTexts(["a", "b"], { env, fetchImpl: (async () => swapped) as unknown as typeof fetch });
    expect(result.vectors).toEqual([[1], [2]]);
  });

  it("is not_configured without a key, and calls nothing", async () => {
    const fetchImpl = vi.fn();
    await expect(embedTexts(["a"], { env: {}, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("turns a network error, a 5xx, a 4xx and a malformed answer into typed failures that never carry the key", async () => {
    const cases: [() => Promise<Response>, string][] = [
      [async () => { throw new Error("connect ECONNREFUSED engine.example oz_live_secretkey"); }, "unreachable"],
      [async () => new Response("", { status: 503 }), "unreachable"],
      [async () => new Response("", { status: 403 }), "refused"],
      [async () => new Response("not json", { status: 200 }), "bad_response"],
      [async () => new Response(JSON.stringify({ runId: "r", model: "m", data: [] }), { status: 200 }), "bad_response"],
      [async () => answer([[1, 2], [3]]), "bad_response"],
    ];
    for (const [fetchImpl, code] of cases) {
      resetBreaker();
      const error = await embedTexts(["a"], { env, fetchImpl: fetchImpl as unknown as typeof fetch }).catch((e) => e);
      expect(error).toBeInstanceOf(OrazakaUnavailableError);
      expect(error.code).toBe(code);
      expect(String(error.message)).not.toContain("oz_live_secretkey");
    }
  });

  it("stops calling after repeated failures, then tries again when the pause is over", async () => {
    let clock = 1_000_000;
    const down = vi.fn(async () => new Response("", { status: 503 }));
    for (let i = 0; i < BREAKER_FAILURES; i++) {
      await expect(embedTexts(["a"], { env, fetchImpl: down as unknown as typeof fetch, now: () => clock })).rejects.toMatchObject({ code: "unreachable" });
    }
    expect(breakerState(clock).open).toBe(true);

    await expect(embedTexts(["a"], { env, fetchImpl: down as unknown as typeof fetch, now: () => clock })).rejects.toMatchObject({ code: "circuit_open" });
    expect(down).toHaveBeenCalledTimes(BREAKER_FAILURES);

    clock += BREAKER_OPEN_MS + 1;
    const up = vi.fn(async () => answer([[1]]));
    await expect(embedTexts(["a"], { env, fetchImpl: up as unknown as typeof fetch, now: () => clock })).resolves.toMatchObject({ runId: "run-1" });
    expect(breakerState(clock)).toMatchObject({ open: false, failures: 0 });
  });

  it("refuses an empty, blank or oversized batch before any call", async () => {
    const fetchImpl = vi.fn();
    for (const texts of [[], [" "], Array.from({ length: 129 }, () => "x")]) {
      await expect(embedTexts(texts, { env, fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toThrow(/non-blank/);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("callOrazaka (the recommender's calls)", () => {
  const schema = z.object({ ok: z.boolean() });

  it("sends the query and the key, parses the answer and returns Orazaka's request id", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "x-orazaka-request-id": "req-1" } }));
    const result = await callOrazaka({ method: "GET", path: "/api/v1/recommendations/for-you", query: { user: "p", limit: 3, exclude: "" }, schema, env, fetchImpl: fetchImpl as unknown as typeof fetch });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://engine.example/edge/api/v1/recommendations/for-you?user=p&limit=3");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer oz_live_secretkey");
    expect(result).toMatchObject({ data: { ok: true }, requestId: "req-1" });
  });

  it("is not_found on a 404 without opening the breaker; a wrong shape is bad_response", async () => {
    for (let i = 0; i < BREAKER_FAILURES + 1; i++) {
      const e = await callOrazaka({ method: "GET", path: "/x", schema, env, fetchImpl: (async () => new Response("", { status: 404 })) as unknown as typeof fetch }).catch((x) => x);
      expect(e.code).toBe("not_found");
    }
    expect(breakerState().open).toBe(false);
    const bad = await callOrazaka({ method: "POST", path: "/x", body: {}, schema, env, fetchImpl: (async () => new Response(JSON.stringify({ ok: "yes" }))) as unknown as typeof fetch }).catch((x) => x);
    expect(bad.code).toBe("bad_response");
  });

  it("background calls (breaker: false) neither open the breaker nor are stopped by it", async () => {
    const down = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    for (let i = 0; i < BREAKER_FAILURES + 2; i++) {
      const e = await callOrazaka({ method: "POST", path: "/x", body: {}, schema, env, breaker: false, fetchImpl: down }).catch((x) => x);
      expect(e.code).toBe("unreachable");
    }
    expect(breakerState().open).toBe(false);
  });
});
