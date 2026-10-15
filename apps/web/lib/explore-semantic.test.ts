import { describe, expect, it, vi } from "vitest";

import type { ExploreResults, ExploreVideo, ExploreViewer } from "./explore";
import { exploreResultsByMeaning, type MeaningDeps, type SimilarDeps, similarVideos } from "./explore-semantic";

const video = (id: string): ExploreVideo => ({ id, title: id, creatorName: "c", creatorUsername: "c", creatorAvatar: null, thumbnailUrl: null, previewAnimationUrl: null, width: null, height: null, durationSeconds: 1, visibility: "PUBLIC", minTipAmountCents: 0, viewsCount: 0, tipsCount: 0, likesCount: 0, commentsCount: 0, tags: [], isBlurred: false, isAdult: false, createdAt: "2026-01-01T00:00:00.000Z" });
const base = (ids: string[]): ExploreResults => ({ videos: ids.map(video), hasMore: false, creators: [], stories: [] });

function deps(over: Partial<MeaningDeps> = {}): MeaningDeps {
  return {
    base: vi.fn(async () => base(["a", "b"])),
    vector: vi.fn(async () => ({ vector: [1], model: "m", status: "ok" as const })),
    nearest: vi.fn(async () => ["c", "a"]),
    byIds: vi.fn(async (ids: string[]) => ids.map(video)),
    ...over,
  };
}

const member = { id: "u1" } as unknown as ExploreViewer;

describe("exploreResultsByMeaning", () => {
  it("merges what the words found with what the meaning found, and says how each was found", async () => {
    const result = await exploreResultsByMeaning(member, { q: "sunrise" }, deps());
    expect(result.videos.map((v) => [v.id, v.via])).toEqual([["a", "both"], ["c", "meaning"], ["b", "text"]]);
    expect(result.meaning).toEqual({ status: "ok", found: 2 });
  });

  it("fetches only the videos the words did not already bring", async () => {
    const d = deps();
    await exploreResultsByMeaning(member, { q: "sunrise" }, d);
    expect(d.byIds).toHaveBeenCalledWith(["c"], member);
  });

  it.each([
    ["Orazaka unreachable", { status: "unavailable" as const }, "unavailable"],
    ["Orazaka not configured", { status: "off" as const }, "off"],
    ["throttled", { status: "throttled" as const }, "throttled"],
  ])("falls back to the exact full-text answer when %s", async (_n, vector, status) => {
    const d = deps({ vector: vi.fn(async () => vector) });
    const result = await exploreResultsByMeaning(member, { q: "sunrise" }, d);
    expect(result.videos).toEqual(base(["a", "b"]).videos);
    expect(result.videos.every((v) => v.via === undefined)).toBe(true);
    expect(result.meaning).toEqual({ status, found: 0 });
    expect(d.nearest).not.toHaveBeenCalled();
  });

  it("falls back when the vector query itself fails (pgvector missing, database error)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps({ nearest: vi.fn(async () => { throw new Error("type vector does not exist"); }) });
    const result = await exploreResultsByMeaning(member, { q: "sunrise" }, d);
    expect(result.videos.map((v) => v.id)).toEqual(["a", "b"]);
    expect(result.meaning.status).toBe("unavailable");
  });

  it("leaves a browse, a tag and later pages to the full-text ranking alone, without calling Orazaka", async () => {
    for (const query of [{}, { q: "  " }, { q: "x", tag: "city" }, { q: "x", page: 2 }]) {
      const d = deps();
      const result = await exploreResultsByMeaning(member, query, d);
      expect(result.meaning.status).toBe("off");
      expect(d.vector).not.toHaveBeenCalled();
    }
  });

  it("keeps the answer when the meaning finds nothing near", async () => {
    const result = await exploreResultsByMeaning(member, { q: "sunrise" }, deps({ nearest: vi.fn(async () => []) }));
    expect(result.videos.map((v) => v.id)).toEqual(["a", "b"]);
    expect(result.meaning).toEqual({ status: "ok", found: 0 });
  });

  it("never calls Orazaka for a visitor who is not signed in: a paid embedding is for accounts, the answer is full-text", async () => {
    const d = deps();
    const result = await exploreResultsByMeaning(null, { q: "sunrise" }, d);
    expect(d.vector).not.toHaveBeenCalled();
    expect(d.nearest).not.toHaveBeenCalled();
    expect(result.videos.map((v) => v.id)).toEqual(["a", "b"]);
    expect(result.meaning).toEqual({ status: "off", found: 0 });
  });
});

describe("similarVideos — 'more like this'", () => {
  const similarDeps = (over: Partial<SimilarDeps> = {}): SimilarDeps => ({
    related: vi.fn(async () => ["x", "y"]),
    byIds: vi.fn(async (ids: string[]) => ids.map(video)),
    byTags: vi.fn(async () => [video("t1")]),
    ...over,
  });

  it("is the videos nearest in meaning, in order", async () => {
    const d = similarDeps();
    const result = await similarVideos("v", null, 4, d);
    expect(result.map((v) => [v.id, v.via])).toEqual([["x", "meaning"], ["y", "meaning"]]);
    expect(d.byTags).not.toHaveBeenCalled();
  });

  it("is the videos sharing its tags when it has no vector yet", async () => {
    const result = await similarVideos("v", null, 4, similarDeps({ related: vi.fn(async () => []) }));
    expect(result.map((v) => v.id)).toEqual(["t1"]);
  });

  it("is the videos sharing its tags when the vector query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await similarVideos("v", null, 4, similarDeps({ related: vi.fn(async () => { throw new Error("no pgvector"); }) }));
    expect(result.map((v) => v.id)).toEqual(["t1"]);
  });
});
