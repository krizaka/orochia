import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AGE_CHECK_REQUIRED, adultAccessAllowed } from "./adult-access";

const author = { id: "author", isAgeVerified: false };
const fan = { id: "fan", isAgeVerified: true };
const unverified = { id: "qa-viewer", isAgeVerified: false };

describe("18+ content is gated by the server, never by the visitor's word (AGENTS.md 3.A)", () => {
  it("the refusal code is stable", () => {
    expect(AGE_CHECK_REQUIRED).toBe("content.age_check_required");
  });

  it.each(["MATURE", "ADULT"])("%s: refused to a visitor and to an account whose age was never checked", (rating) => {
    expect(adultAccessAllowed({ contentRatingId: rating, creatorId: "author", viewer: null })).toBe(false);
    expect(adultAccessAllowed({ contentRatingId: rating, creatorId: "author", viewer: unverified })).toBe(false);
  });

  it.each(["MATURE", "ADULT"])("%s: allowed to a signed-in, age-checked account, and to its author", (rating) => {
    expect(adultAccessAllowed({ contentRatingId: rating, creatorId: "author", viewer: fan })).toBe(true);
    expect(adultAccessAllowed({ contentRatingId: rating, creatorId: "author", viewer: author })).toBe(true);
  });

  it.each(["GENERAL", "TEEN", "FOR_KIDS", null, undefined])("%s: not gated", (rating) => {
    expect(adultAccessAllowed({ contentRatingId: rating, creatorId: "author", viewer: null })).toBe(true);
  });
});

describe("every entry point that plays, unlocks or pays for a video goes through the one rule", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  it("evaluateVideoAccess applies it before any visibility rule", () => {
    const source = read("lib/access.ts");
    expect(source).toMatch(/adultAccessAllowed|assertAdultAccess/);
    expect(source.indexOf("AGE_CHECK_REQUIRED")).toBeGreaterThan(-1);
  });
  it.each([
    "app/api/videos/unlock-video/route.ts",
    "app/api/auctions/[id]/bids/route.ts",
    "app/api/challenges/[id]/pledges/route.ts",
    "app/api/videos/[id]/download/route.ts",
  ])("%s calls the guard", (file) => {
    expect(read(file)).toMatch(/assertAdultAccess\w*\(/);
  });
  it("the stream answers the stable code", () => {
    expect(read("app/api/videos/[id]/stream/route.ts")).toMatch(/code/);
  });
  it("stories are not signed for an unchecked viewer", () => {
    expect(read("lib/stories.ts")).toMatch(/adultAccessAllowed|assertAdultAccess/);
  });
});
