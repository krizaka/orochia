import { videoVisibilityEnum } from "@orochia/db";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  DISCOVERABLE_VISIBILITY,
  type DiscoveryFacts,
  HOLDING_REPORT_REASONS,
  isDiscoverableCreator,
  isDiscoverableStory,
  isDiscoverableVideo,
  isVeiled,
} from "./discoverable";
import { discoverableStory, discoverableVideo, exploreTag } from "./explore";

const NOW = new Date("2026-10-09T12:00:00Z");
const publicVideo: DiscoveryFacts = { visibility: "PUBLIC", status: "READY", removedAt: null, creatorSuspended: false, heldForReview: false };
const liveStory = { ...publicVideo, expiresAt: new Date(NOW.getTime() + 3600_000) };

describe("Explore never leaks what is not public", () => {
  it("a public, ready video of an active creator is discoverable", () => {
    expect(isDiscoverableVideo(publicVideo)).toBe(true);
  });

  // Every audience other than PUBLIC: followers, contacts, close friends / lists, paid unlocks, auctions, challenges.
  const restricted = videoVisibilityEnum.enumValues.filter((v) => v !== "PUBLIC");
  it.each(restricted)("a %s video never appears", (visibility) => {
    expect(isDiscoverableVideo({ ...publicVideo, visibility })).toBe(false);
  });
  it.each(restricted)("a %s story never appears", (visibility) => {
    expect(isDiscoverableStory({ ...liveStory, visibility }, NOW)).toBe(false);
  });
  it("the restricted audiences cover followers, contacts, close friends and paid content", () => {
    expect(restricted).toEqual(expect.arrayContaining(["APPROVED_FOLLOWERS_ONLY", "CONTACTS_ONLY", "INVITED_ONLY", "TIPPED_UNLOCKED", "AUCTION", "CHALLENGE"]));
  });

  it("a video still encoding, failed or waiting for its upload does not appear", () => {
    for (const status of ["PENDING_UPLOAD", "PROCESSING", "FAILED"]) expect(isDiscoverableVideo({ ...publicVideo, status })).toBe(false);
  });
  it("a video taken down or deleted by its creator does not appear", () => {
    expect(isDiscoverableVideo({ ...publicVideo, removedAt: NOW })).toBe(false);
  });
  it("a suspended creator's work does not appear", () => {
    expect(isDiscoverableVideo({ ...publicVideo, creatorSuspended: true })).toBe(false);
    expect(isDiscoverableStory({ ...liveStory, creatorSuspended: true }, NOW)).toBe(false);
  });
  it("content reported as a suspected minor or non-consensual is held until resolved", () => {
    expect(isDiscoverableVideo({ ...publicVideo, heldForReview: true })).toBe(false);
    expect(isDiscoverableStory({ ...liveStory, heldForReview: true }, NOW)).toBe(false);
    expect([...HOLDING_REPORT_REASONS].sort()).toEqual(["NON_CONSENSUAL", "UNDERAGE"]);
  });
  it("an expired story does not appear", () => {
    expect(isDiscoverableStory(liveStory, NOW)).toBe(true);
    expect(isDiscoverableStory({ ...liveStory, expiresAt: NOW }, NOW)).toBe(false);
  });

  it("a creator is suggested only when active, verified and with public work", () => {
    const creator = { role: "CREATOR", isVerified: true, suspended: false, discoverableItems: 1 };
    expect(isDiscoverableCreator(creator)).toBe(true);
    expect(isDiscoverableCreator({ ...creator, isVerified: false })).toBe(false); // 2257 review pending
    expect(isDiscoverableCreator({ ...creator, suspended: true })).toBe(false);
    expect(isDiscoverableCreator({ ...creator, discoverableItems: 0 })).toBe(false); // only private work
    expect(isDiscoverableCreator({ ...creator, role: "MEMBER" })).toBe(false);
  });
});

describe("the SQL says the same", () => {
  const dialect = new PgDialect();
  const video = dialect.sqlToQuery(discoverableVideo());
  const story = dialect.sqlToQuery(discoverableStory());

  it("filters on PUBLIC only, never on another audience", () => {
    for (const q of [video, story]) {
      expect(q.params).toContain(DISCOVERABLE_VISIBILITY);
      for (const other of videoVisibilityEnum.enumValues.filter((v) => v !== "PUBLIC")) expect(q.params).not.toContain(other);
      expect(q.sql).toMatch(/"visibility" = \$\d+/);
    }
  });
  it("checks ready, not removed, active creator, and held reports", () => {
    expect(video.sql).toContain('"videos"."removed_at" is null');
    expect(video.sql).toContain('"users"."suspended_at" is null');
    expect(video.sql).toContain("not exists");
    expect(video.params).toEqual(expect.arrayContaining(["READY", "OPEN", "IN_REVIEW", "UNDERAGE", "NON_CONSENSUAL"]));
    expect(story.sql).toContain('"stories"."expires_at" > now()');
    expect(story.sql).toContain('"stories"."removed_at" is null');
    expect(story.sql).toContain('"compliance_reports"."story_id"');
  });
});

describe("the 18+ veil", () => {
  const plain = { isBlurred: false, ratingRequiresBlur: false, ratingIsAdult: false };
  it("blurs what the creator or the rating asks to, for everyone", () => {
    expect(isVeiled({ ...plain, isBlurred: true }, true)).toBe(true);
    expect(isVeiled({ ...plain, ratingRequiresBlur: true }, true)).toBe(true);
  });
  it("blurs adult ratings for visitors whose age the server has not checked", () => {
    expect(isVeiled({ ...plain, ratingIsAdult: true }, false)).toBe(true);
    expect(isVeiled({ ...plain, ratingIsAdult: true }, true)).toBe(false);
    expect(isVeiled(plain, false)).toBe(false);
  });
});

describe("the tag in the address", () => {
  it("is normalised like a stored tag", () => {
    expect(exploreTag("BTS")).toBe("behind-the-scenes");
    expect(exploreTag("#Acoustic")).toBe("acoustic");
    expect(exploreTag("")).toBeNull();
    expect(exploreTag("'; drop table videos; --")).toBe("drop-table-videos");
  });
});
