import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ADULT_RATING_IDS, isAdultRating } from "./content-ratings";

describe("the 18+ ratings follow the ids of the reference data", () => {
  it("MATURE and ADULT are 18+ (the ids /api/reference/content-ratings serves)", () => {
    expect(isAdultRating("MATURE")).toBe(true);
    expect(isAdultRating("ADULT")).toBe(true);
  });

  it("the other ratings, a missing one and the retired ids are not", () => {
    for (const id of ["FOR_KIDS", "GENERAL", "TEEN", null, undefined, "MATURE_18", "ADULT_EXPLICIT"]) expect(isAdultRating(id)).toBe(false);
  });

  it("the db seed marks exactly these ids as adult", () => {
    const seed = readFileSync(new URL("../../../packages/db/src/seed.ts", import.meta.url), "utf8");
    const adult = [...seed.matchAll(/\{ id: "([A-Z_]+)",[^\n]*isAdult: true/g)].map((m) => m[1]).sort();
    expect(adult).toEqual([...ADULT_RATING_IDS].sort());
  });

  it("no component compares a rating to a literal id that does not exist", () => {
    for (const file of ["../components/VideoCard.tsx", "../components/VideoPlayer.tsx"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/MATURE_18|ADULT_EXPLICIT/);
    }
  });
});

describe("a card learns the rating from the query", () => {
  it("an adult rating reaches the Explore video, veiled or not", async () => {
    const { toExploreVideo } = await import("./explore");
    const row = {
      id: "v", title: "t", creatorId: "c", creatorName: "n", creatorUsername: "u", creatorAvatar: null, thumbnailUrl: null, previewAnimationUrl: null,
      width: null, height: null, durationSeconds: 5, visibility: "PUBLIC", minTipAmountCents: 0, viewsCount: 0, tipsCount: 0, likesCount: 0,
      commentsCount: 0, tags: [], isBlurred: false, ratingRequiresBlur: false, ratingIsAdult: true, createdAt: new Date("2026-10-15T00:00:00Z"),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checked = toExploreVideo(row as any, { id: "x", role: "MEMBER", isAgeVerified: true });
    expect(checked.isAdult).toBe(true);
    expect(checked.isBlurred).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const visitor = toExploreVideo(row as any, null);
    expect(visitor.isAdult).toBe(true);
    expect(visitor.isBlurred).toBe(true);
  });
});
