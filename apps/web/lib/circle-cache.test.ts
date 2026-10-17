import { afterEach, describe, expect, it, vi } from "vitest";

import { createCircleCache, trailing } from "./circle-cache";

afterEach(() => vi.useRealTimers());

describe("the presence circle cache (#158: a reconnect storm must not hit PostgreSQL with the same query)", () => {
  it("answers from memory within the TTL, and loads again after it", async () => {
    let t = 0;
    const load = vi.fn(async (id: string) => [`${id}-friend`]);
    const cache = createCircleCache({ ttlMs: 30_000, now: () => t, load });
    expect(await cache.get("a")).toEqual(["a-friend"]);
    expect(await cache.get("a")).toEqual(["a-friend"]);
    expect(load).toHaveBeenCalledTimes(1);
    t = 30_001;
    await cache.get("a");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between simultaneous callers (ten cold launches, one query)", async () => {
    let release!: (ids: string[]) => void;
    const load = vi.fn(() => new Promise<string[]>((resolve) => (release = resolve)));
    const cache = createCircleCache({ ttlMs: 30_000, now: () => 0, load });
    const calls = Array.from({ length: 10 }, () => cache.get("a"));
    release(["x"]);
    expect((await Promise.all(calls)).every((r) => r[0] === "x")).toBe(true);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("forgets an account when its circle changes (a block, a setting)", async () => {
    const load = vi.fn(async () => ["x"]);
    const cache = createCircleCache({ ttlMs: 30_000, now: () => 0, load });
    await cache.get("a");
    cache.invalidate("a");
    await cache.get("a");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failure", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("pool")).mockResolvedValue(["x"]);
    const cache = createCircleCache({ ttlMs: 30_000, now: () => 0, load });
    await expect(cache.get("a")).rejects.toThrow("pool");
    expect(await cache.get("a")).toEqual(["x"]);
  });

  it("keeps at most `max` accounts", async () => {
    const load = vi.fn(async (id: string) => [id]);
    const cache = createCircleCache({ ttlMs: 30_000, now: () => 0, load, max: 2 });
    await cache.get("a");
    await cache.get("b");
    await cache.get("c");
    expect(cache.size()).toBe(2);
  });
});

describe("trailing debounce (circle_changed bursts)", () => {
  it("runs once, after the burst", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const call = trailing(run, 1000);
    call();
    call();
    call();
    vi.advanceTimersByTime(999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("can be cancelled when the stream closes", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const call = trailing(run, 1000);
    call();
    call.cancel();
    vi.advanceTimersByTime(5000);
    expect(run).not.toHaveBeenCalled();
  });
});
