import { describe, expect, it, vi } from "vitest";

import type { ExploreVideo } from "../explore";
import { OrazakaUnavailableError } from "../orazaka";
import { retryDelaySeconds } from "./recommendations.outbox";
import { forYouShelf, type ShelfDeps, similarShelf } from "./recommendations.service";
import { type Pseudonym, type RecommendationSettings, ShelfSource } from "./recommendations.types";

const settings: RecommendationSettings = {
  enabled: true, timeoutMs: 800, syncTimeoutMs: 10_000, forYouLimit: 3, similarLimit: 2, outboxBatch: 200, outboxIntervalSeconds: 15,
  retryBaseSeconds: 15, retryMaxSeconds: 3600, maxAttempts: 20, sentRetentionDays: 7, catalogueIntervalSeconds: 300, catalogueBatch: 50,
  skipWithinSeconds: 3, skipBelowPct: 20, audienceDays: 28, audienceFunnel: ["view", "like", "tip"],
};
const video = (id: string) => ({ id }) as ExploreVideo;
const viewer = { id: "acc-1", role: "MEMBER" };
const feed = (ids: string[]) => ({
  data: { requestId: "0d9c8b7a-6f5e-4d3c-2b1a-0f9e8d7c6b5a", strategy: "personal" as const, candidates: ids.length, items: ids.map((id) => ({ id, score: 1, reasons: ["similar" as const] })) },
  requestId: "0d9c8b7a-6f5e-4d3c-2b1a-0f9e8d7c6b5a",
  ms: 5,
});

function deps(overrides: Partial<ShelfDeps> = {}): ShelfDeps {
  return {
    settings: async () => settings,
    pseudonym: () => "p".repeat(64) as Pseudonym,
    forYou: vi.fn(async () => feed(["a", "hidden", "b"])),
    similar: vi.fn(async () => feed(["s1"])),
    // Orochia's discovery rules: "hidden" is not discoverable any more.
    byIds: async (ids) => ids.filter((id) => id !== "hidden").map(video),
    fallbackForYou: async () => [video("t1"), video("a"), video("t2")],
    fallbackSimilar: async () => [video("tag1"), video("tag2")],
    ...overrides,
  };
}

describe("the For you shelf", () => {
  it("shows Orazaka's order, filtered by Orochia's rules, completed by trending without duplicates", async () => {
    const shelf = await forYouShelf(viewer, deps());
    expect(shelf.source).toBe(ShelfSource.Orazaka);
    expect(shelf.videos.map((v) => v.id)).toEqual(["a", "b", "t1"]);
    expect(shelf.videos[0].reasons).toEqual(["similar"]);
    expect(shelf.requestId).toBe("0d9c8b7a-6f5e-4d3c-2b1a-0f9e8d7c6b5a");
  });

  it("falls back to trending when Orazaka is down, the feature is off, or the visitor is not signed in", async () => {
    const down = await forYouShelf(viewer, deps({ forYou: async () => { throw new OrazakaUnavailableError("unreachable", "x"); } }));
    expect(down.source).toBe(ShelfSource.Fallback);
    expect(down.videos.map((v) => v.id)).toEqual(["t1", "a", "t2"]);
    const forYou = vi.fn();
    expect((await forYouShelf(viewer, deps({ settings: async () => ({ ...settings, enabled: false }), forYou }))).source).toBe(ShelfSource.Fallback);
    expect((await forYouShelf(null, deps({ forYou }))).source).toBe(ShelfSource.Fallback);
    expect(forYou).not.toHaveBeenCalled();
  });
});

describe("the More like this shelf", () => {
  it("is Orazaka's neighbours, completed by Orochia's, never the video itself", async () => {
    const shelf = await similarShelf("v", viewer, deps({ fallbackSimilar: async () => [video("v"), video("tag1")] }));
    expect(shelf.videos.map((x) => x.id)).toEqual(["s1", "tag1"]);
  });

  it("falls back to Orochia's answer when Orazaka does not know the video", async () => {
    const shelf = await similarShelf("v", viewer, deps({ similar: async () => { throw new OrazakaUnavailableError("not_found", "x"); } }));
    expect(shelf.source).toBe(ShelfSource.Fallback);
  });
});

describe("the outbox retry", () => {
  it("doubles from the base and is capped", () => {
    expect([0, 1, 2, 10].map((n) => retryDelaySeconds(n, settings))).toEqual([15, 30, 60, 3600]);
  });
});
