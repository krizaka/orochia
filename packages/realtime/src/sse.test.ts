import { describe, expect, it } from "vitest";

import { busKind, createBus } from "./index";
import { eventStream, sseFrame } from "./sse";

describe("Server-Sent Events", () => {
  it("frames id, event, data and retry; a line break cannot inject a field", () => {
    expect(sseFrame({ id: "m42", event: "message", data: { a: 1 } })).toBe('id: m42\nevent: message\ndata: {"a":1}\n\n');
    expect(sseFrame({ retry: 1500 })).toBe("retry: 1500\n\n");
    expect(sseFrame({ comment: "x\ndata: evil" })).toBe(": x data: evil\n\n");
    expect(sseFrame({ data: "a\nb" })).toBe('data: "a\\nb"\n\n');
  });

  it("streams what start sends, then runs the cleanup when the client goes away", async () => {
    let cleaned = false;
    const res = eventStream({
      retryMs: 1000,
      start: ({ send }) => {
        send({ event: "connected", data: { ok: true } });
        return () => {
          cleaned = true;
        };
      },
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    let text = "";
    while (!text.includes("connected")) text += new TextDecoder().decode((await reader.read()).value);
    expect(text).toContain("retry: 1000");
    await reader.cancel();
    expect(cleaned).toBe(true);
  });

  it("ends by itself after its maximum lifetime", async () => {
    const res = eventStream({ maxLifetimeMs: 30, start: () => undefined });
    const reader = res.body!.getReader();
    let done = false;
    while (!done) done = (await reader.read()).done;
    expect(done).toBe(true);
  });
});

describe("configuration", () => {
  it("defaults to postgres and refuses an unknown bus", () => {
    expect(busKind(undefined)).toBe("postgres");
    expect(busKind(" Redis ")).toBe("redis");
    expect(() => busKind("kafka")).toThrow(/REALTIME_BUS/);
  });

  it("refuses redis without a URL rather than falling back", () => {
    expect(() => createBus({ kind: "redis" })).toThrow(/REDIS_URL/);
    expect(createBus({ kind: "memory" }).kind).toBe("memory");
  });
});
