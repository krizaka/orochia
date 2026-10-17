import { describe, expect, it } from "vitest";

import { blendFresh, classifyWatch, FEED_RANK_DEFAULTS, type FeedCandidate,limitConsecutive, recencyRerank, velocityScores } from "./feed-ranking";

const NOW = new Date("2026-10-17T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const item = (id: string, creatorId: string, h = 1): FeedCandidate => ({ id, creatorId, createdAt: hoursAgo(h) });

describe("limitConsecutive (diversity rule)", () => {
  it("never shows more than N consecutive items from one creator when others can fill in", () => {
    const flood = [...Array.from({ length: 9 }, (_, i) => item(`m${i}`, "mascots")), ...Array.from({ length: 4 }, (_, i) => item(`o${i}`, "orazaka")), item("x", "someone")];
    const out = limitConsecutive(flood, 2);
    expect(out).toHaveLength(flood.length);
    let run = 0;
    let last = "";
    const longest: number[] = [];
    for (const v of out.slice(0, 10)) {
      run = v.creatorId === last ? run + 1 : 1;
      last = v.creatorId;
      longest.push(run);
    }
    expect(Math.max(...longest)).toBeLessThanOrEqual(2);
  });

  it("keeps every item exactly once and the order when nobody floods", () => {
    const calm = [item("a", "1"), item("b", "2"), item("c", "1"), item("d", "3")];
    expect(limitConsecutive(calm, 2).map((v) => v.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("when only one creator is left the run is unavoidable, nothing is dropped", () => {
    const only = [item("a", "1"), item("b", "1"), item("c", "1")];
    expect(limitConsecutive(only, 2).map((v) => v.id)).toEqual(["a", "b", "c"]);
  });

  it("N comes from the settings, and is at least 1", () => {
    const flood = [item("a", "1"), item("b", "1"), item("c", "2"), item("d", "2")];
    expect(limitConsecutive(flood, 1).map((v) => v.creatorId)).toEqual(["1", "2", "1", "2"]);
    expect(limitConsecutive(flood, 0).map((v) => v.creatorId)).toEqual(["1", "2", "1", "2"]);
  });

  it("does not treat an official account differently: it is interleaved like anyone", () => {
    const official = Array.from({ length: 5 }, (_, i) => ({ ...item(`k${i}`, "krizaka-official"), official: true }));
    const out = limitConsecutive([...official, item("u", "fan")], 2);
    expect(out.slice(0, 3).map((v) => v.creatorId)).toEqual(["krizaka-official", "krizaka-official", "fan"]);
  });
});

describe("blendFresh (signed-out default)", () => {
  const trending = ["t1", "t2", "t3", "t4"].map((id) => item(id, id));
  const fresh = ["f1", "f2", "f3", "f4"].map((id) => item(id, id));
  it("alternates trending and fresh by the share, not pure chronology", () => {
    expect(blendFresh(trending, fresh, 0.5).map((v) => v.id)).toEqual(["t1", "f1", "t2", "f2", "t3", "f3", "t4", "f4"]);
  });
  it("a share of 0 is chronology, 1 is trending only first", () => {
    expect(blendFresh(trending, fresh, 0).map((v) => v.id).slice(0, 4)).toEqual(["f1", "f2", "f3", "f4"]);
    expect(blendFresh(trending, fresh, 1).map((v) => v.id).slice(0, 4)).toEqual(["t1", "t2", "t3", "t4"]);
  });
  it("lists a video once even if both sources have it, and runs dry gracefully", () => {
    const out = blendFresh([item("a", "1")], [item("a", "1"), item("b", "2")], 0.5);
    expect(out.map((v) => v.id)).toEqual(["a", "b"]);
  });
});

describe("recencyRerank (For you from Orazaka's order)", () => {
  it("a fresh item overtakes a slightly better-ranked old one, but a far better one stays on top", () => {
    const ranked = [item("old-best", "1", 24 * 30), item("fresh", "2", 1), item("old-2", "3", 24 * 30)];
    const out = recencyRerank(ranked, NOW, { halfLifeHours: 72, floor: 0.2 });
    expect(out.map((v) => v.id)).toEqual(["fresh", "old-best", "old-2"]);
  });
  it("keeps Orazaka's order among items of the same age", () => {
    const ranked = [item("a", "1", 5), item("b", "2", 5), item("c", "3", 5)];
    expect(recencyRerank(ranked, NOW, { halfLifeHours: 72, floor: 0.2 }).map((v) => v.id)).toEqual(["a", "b", "c"]);
  });
});

describe("velocityScores (Trending)", () => {
  it("rates engagement per recent hours: a burst today beats a bigger pile a week ago", () => {
    const scores = velocityScores(
      [
        { itemId: "burst", kind: "like", at: hoursAgo(2), count: 10 },
        { itemId: "pile", kind: "like", at: hoursAgo(24 * 6), count: 100 },
      ],
      NOW,
      FEED_RANK_DEFAULTS,
    );
    expect(scores.get("burst")!).toBeGreaterThan(scores.get("pile") ?? 0);
  });
  it("ignores events outside the window", () => {
    const scores = velocityScores([{ itemId: "x", kind: "view", at: hoursAgo(FEED_RANK_DEFAULTS.velocityWindowHours + 1), count: 5 }], NOW, FEED_RANK_DEFAULTS);
    expect(scores.has("x")).toBe(false);
  });
});

describe("classifyWatch (watch-time and skip events)", () => {
  const s = FEED_RANK_DEFAULTS;
  it("a flick past a slide counts for nothing", () => {
    expect(classifyWatch({ watchedPct: 3, dwellMs: s.minDwellMs - 1 }, s)).toBeNull();
  });
  it("leaving early after a real look is a skip", () => {
    expect(classifyWatch({ watchedPct: s.skipBelowPct - 1, dwellMs: s.minDwellMs }, s)).toBe("SKIP");
  });
  it("watching enough is a view with its watched share", () => {
    expect(classifyWatch({ watchedPct: s.skipBelowPct, dwellMs: 9000 }, s)).toBe("VIEW");
    expect(classifyWatch({ watchedPct: 100, dwellMs: 20000 }, s)).toBe("VIEW");
  });
});
