import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { createTtlMemo } from "./ttl-memo";

describe("a short memory for what every visitor sees (orochia ORO-PERF: /explore answered in 1.2 s of server time)", () => {
  it("answers from memory within the TTL and loads again after it", async () => {
    let t = 0;
    const load = vi.fn(async () => ({ n: 1 }));
    const memo = createTtlMemo<{ n: number }>({ ttlMs: 30_000, now: () => t });
    expect(await memo.get("visitor", load)).toEqual({ n: 1 });
    expect(await memo.get("visitor", load)).toEqual({ n: 1 });
    expect(load).toHaveBeenCalledTimes(1);
    t = 30_001;
    await memo.get("visitor", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one load between simultaneous callers", async () => {
    let release!: (v: number) => void;
    const load = vi.fn(() => new Promise<number>((resolve) => (release = resolve)));
    const memo = createTtlMemo<number>({ ttlMs: 30_000, now: () => 0 });
    const calls = Array.from({ length: 5 }, () => memo.get("k", load));
    release(7);
    expect(await Promise.all(calls)).toEqual([7, 7, 7, 7, 7]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps nothing when the load fails, nor what the caller says is incomplete", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("pool")).mockResolvedValue({ ok: true, partial: true });
    const memo = createTtlMemo<{ ok: boolean; partial: boolean }>({ ttlMs: 30_000, now: () => 0, keep: (v) => !v.partial });
    await expect(memo.get("k", load)).rejects.toThrow("pool");
    expect(await memo.get("k", load)).toEqual({ ok: true, partial: true });
    await memo.get("k", load);
    expect(load).toHaveBeenCalledTimes(3); // the partial answer was not kept
  });

  it("forgets a key on demand and bounds the number of keys", async () => {
    const memo = createTtlMemo<number>({ ttlMs: 30_000, now: () => 0, max: 2 });
    for (const k of ["a", "b", "c"]) await memo.get(k, async () => 1);
    expect(memo.size()).toBe(2);
    memo.forget("c");
    expect(memo.size()).toBe(1);
  });
});

describe("what Explore keeps (ORO-PERF)", () => {
  const src = readFileSync(new URL("./explore.ts", import.meta.url), "utf8");
  it("remembers the visitor's sections only — a signed-in viewer's are personal — and never an incomplete answer", () => {
    expect(src).toMatch(/if \(viewer === null\) return visitorSections\.get\("visitor"/);
    expect(src).toMatch(/keep: \(v\) => v\.unavailable\.size === 0/);
    expect(src).toMatch(/return loadExploreSections\(viewer\);/);
  });
});
