import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "./http";
import { checkRateLimit, enforceRateLimit, limitAction, memoryStore, RateLimitError, type RateLimitStore, useRateLimitStore } from "./rate-limit";

afterEach(() => {
  useRateLimitStore(null);
  vi.unstubAllEnvs();
});

const request = (headers: Record<string, string>) => ({ headers: new Headers({ "user-agent": "Mozilla/5.0", ...headers }) });

describe("the memory store", () => {
  it("counts hits in a fixed window and starts a new one when it ends", async () => {
    const store = memoryStore();
    expect((await store.hit("k", 60, 0)).count).toBe(1);
    expect((await store.hit("k", 60, 1000)).count).toBe(2);
    expect(await store.peek("k", 59_000)).toEqual({ count: 2, resetAt: 60_000 });
    expect((await store.hit("k", 60, 60_000)).count).toBe(1);
    await store.set("lock", 7, 30, 0);
    expect(await store.peek("lock", 29_000)).toEqual({ count: 7, resetAt: 30_000 });
    expect(await store.peek("lock", 31_000)).toBeNull();
    await store.reset("k");
    expect(await store.peek("k", 60_001)).toBeNull();
  });
});

describe("checkRateLimit", () => {
  it("refuses past the limit and says when to retry", async () => {
    useRateLimitStore(memoryStore());
    for (let i = 0; i < 3; i++) expect((await checkRateLimit("a", 3, 120)).success).toBe(true);
    const refused = await checkRateLimit("a", 3, 120);
    expect(refused.success).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSeconds).toBeGreaterThan(100);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(120);
  });

  it("lets the request through when the store fails (a limiter outage never takes the site down)", async () => {
    const broken: RateLimitStore = { name: "broken", hit: () => Promise.reject(new Error("down")), peek: async () => null, set: async () => {}, reset: async () => {} };
    useRateLimitStore(broken);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await checkRateLimit("b", 1, 60)).success).toBe(true);
  });

  it("throws a 429 with a stable code and Retry-After", async () => {
    useRateLimitStore(memoryStore());
    await enforceRateLimit("c", 1, 30);
    const error = await enforceRateLimit("c", 1, 30, "Slow down", "BIDS").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error).toBeInstanceOf(HttpError);
    const e = error as RateLimitError;
    expect(e.status).toBe(429);
    expect(e.message).toBe("Slow down");
    expect(e.extra.code).toBe("BIDS");
    expect(Number(e.headers["Retry-After"])).toBeGreaterThan(0);
  });
});

describe("limitAction — per account AND per IP", () => {
  it("stops one account on many addresses", async () => {
    useRateLimitStore(memoryStore());
    for (let i = 0; i < 2; i++) await limitAction("tip", request({ "x-forwarded-for": `10.0.0.${i}` }), "user-1", { perUser: [2, 60], perIp: [100, 60] });
    await expect(limitAction("tip", request({ "x-forwarded-for": "10.0.0.9" }), "user-1", { perUser: [2, 60], perIp: [100, 60] })).rejects.toBeInstanceOf(RateLimitError);
  });

  it("stops one address with many accounts (or none)", async () => {
    useRateLimitStore(memoryStore());
    for (let i = 0; i < 3; i++) await limitAction("dm", request({ "x-forwarded-for": "10.0.0.1" }), `user-${i}`, { perUser: [100, 60], perIp: [3, 60] });
    await expect(limitAction("dm", request({ "x-forwarded-for": "10.0.0.1" }), null, { perUser: [100, 60], perIp: [3, 60] })).rejects.toBeInstanceOf(RateLimitError);
  });

  it("gives an automated-looking client a quarter of the IP limit", async () => {
    useRateLimitStore(memoryStore());
    const bot = { headers: new Headers({ "user-agent": "python-requests/2.31", "x-forwarded-for": "10.9.9.9" }) };
    await limitAction("search", bot, null, { perIp: [8, 60] });
    await limitAction("search", bot, null, { perIp: [8, 60] });
    await expect(limitAction("search", bot, null, { perIp: [8, 60] })).rejects.toBeInstanceOf(RateLimitError);
  });

  it("cannot be dodged by writing X-Forwarded-For (the address the proxy saw is the right-most)", async () => {
    useRateLimitStore(memoryStore());
    const forged = (fake: string) => request({ "x-forwarded-for": `${fake}, 203.0.113.7` });
    await limitAction("report", forged("1.1.1.1"), null, { perIp: [2, 60] });
    await limitAction("report", forged("2.2.2.2"), null, { perIp: [2, 60] });
    await expect(limitAction("report", forged("3.3.3.3"), null, { perIp: [2, 60] })).rejects.toBeInstanceOf(RateLimitError);
  });
});
