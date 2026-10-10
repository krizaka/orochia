import { describe, expect, it } from "vitest";

import {
  creatorScore,
  decay,
  diversify,
  ENGAGEMENT_WEIGHTS,
  type EngagementBucket,
  rankCreators,
  rankStories,
  rankTrending,
  TRENDING_HALF_LIFE_HOURS,
  trendingScores,
} from "./ranking";

const NOW = new Date("2026-10-09T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600 * 1000);
const video = (id: string, creatorId = "c1", createdHoursAgo = 100) => ({ id, creatorId, createdAt: hoursAgo(createdHoursAgo) });
const bucket = (itemId: string, kind: EngagementBucket["kind"], h: number, count = 1): EngagementBucket => ({ itemId, kind, at: hoursAgo(h), count });

describe("decay", () => {
  it("halves every half-life, never above 1", () => {
    expect(decay(0)).toBe(1);
    expect(decay(TRENDING_HALF_LIFE_HOURS)).toBeCloseTo(0.5);
    expect(decay(2 * TRENDING_HALF_LIFE_HOURS)).toBeCloseTo(0.25);
    expect(decay(-5)).toBe(1);
  });
});

describe("trendingScores", () => {
  it("weighs tips over likes over views", () => {
    const s = trendingScores([bucket("a", "view", 0), bucket("b", "like", 0), bucket("c", "tip", 0)], NOW);
    expect(s.get("c")!).toBeGreaterThan(s.get("b")!);
    expect(s.get("b")!).toBeGreaterThan(s.get("a")!);
    expect(s.get("c")).toBe(ENGAGEMENT_WEIGHTS.tip);
  });
  it("ignores events outside the week", () => {
    expect(trendingScores([bucket("a", "tip", 8 * 24, 100)], NOW).get("a")).toBeUndefined();
  });
});

describe("rankTrending", () => {
  it("a burst today beats the same burst five days ago", () => {
    const ranked = rankTrending([video("old"), video("new")], [bucket("old", "like", 5 * 24, 10), bucket("new", "like", 1, 10)], NOW);
    expect(ranked.map((v) => v.id)).toEqual(["new", "old"]);
  });
  it("many views lose to a few tips of the same moment", () => {
    const ranked = rankTrending([video("views", "c1"), video("tips", "c2")], [bucket("views", "view", 2, 20), bucket("tips", "tip", 2, 2)], NOW);
    expect(ranked[0].id).toBe("tips");
  });
  it("leaves out videos without engagement this week (they are in New)", () => {
    expect(rankTrending([video("quiet")], [], NOW)).toEqual([]);
  });
  it("ties go to the newest video", () => {
    const ranked = rankTrending([video("a", "c1", 50), video("b", "c2", 10)], [bucket("a", "like", 3), bucket("b", "like", 3)], NOW);
    expect(ranked.map((v) => v.id)).toEqual(["b", "a"]);
  });
  it("one creator takes two places at most", () => {
    const vids = ["a", "b", "c", "d"].map((id) => video(id, "same"));
    const ranked = rankTrending([...vids, video("other", "c2")], [...vids.map((v) => bucket(v.id, "tip", 1, 5)), bucket("other", "view", 1)], NOW);
    expect(ranked.filter((v) => v.creatorId === "same")).toHaveLength(2);
    expect(ranked.map((v) => v.id)).toContain("other");
  });
});

describe("diversify", () => {
  it("keeps the order, caps per creator, stops at the limit", () => {
    const items = [{ id: 1, creatorId: "a" }, { id: 2, creatorId: "a" }, { id: 3, creatorId: "b" }, { id: 4, creatorId: "c" }];
    expect(diversify(items, 2, 1).map((i) => i.id)).toEqual([1, 3]);
  });
});

describe("rankStories", () => {
  it("engagement first, freshness breaks the rest", () => {
    const s = (id: string, h: number, likes = 0) => ({ id, creatorId: id, viewsCount: 0, likesCount: likes, tipsCount: 0, createdAt: hoursAgo(h) });
    expect(rankStories([s("old-quiet", 20), s("fresh-quiet", 1), s("liked", 10, 5)], NOW).map((x) => x.id)).toEqual(["liked", "fresh-quiet", "old-quiet"]);
  });
});

describe("rankCreators", () => {
  it("this week's engagement and audience, then recency", () => {
    const base = { followers: 0, weeklyScore: 0, lastPostAt: null as Date | null };
    const ranked = rankCreators(
      [
        { ...base, id: "dormant", followers: 3, lastPostAt: hoursAgo(24 * 60) },
        { ...base, id: "active", weeklyScore: 40, lastPostAt: hoursAgo(2) },
        { ...base, id: "posting", lastPostAt: hoursAgo(1) },
      ],
      NOW,
    );
    expect(ranked.map((c) => c.id)).toEqual(["active", "posting", "dormant"]);
    expect(creatorScore({ id: "x", followers: 0, weeklyScore: 0, lastPostAt: null }, NOW)).toBe(0);
  });
});
