import { describe, expect, it } from "vitest";

import { AMBIENT_BANNERS, BANNER_KINDS, bannerPlayback, resolveBannerChoice, SEGMENT_MAX_SECONDS, SEGMENT_MIN_SECONDS, videoBannerEnabled } from "./banner";

const own = { id: "11111111-1111-4111-8111-111111111111", creatorId: "u1", status: "READY", durationSeconds: 90, removedAt: null, visibility: "PUBLIC", minTipAmountCents: 0 };

describe("banner kinds", () => {
  it("are image, video_segment and ambient", () => {
    expect([...BANNER_KINDS]).toEqual(["image", "video_segment", "ambient"]);
  });
  it("is off unless APP_VIDEO_BANNER is on", () => {
    expect(videoBannerEnabled({})).toBe(false);
    expect(videoBannerEnabled({ APP_VIDEO_BANNER: "off" })).toBe(false);
    expect(videoBannerEnabled({ APP_VIDEO_BANNER: "on" })).toBe(true);
  });
});

describe("resolving a banner choice (one test per kind)", () => {
  const ctx = { userId: "u1", video: own };
  it("image: clears the video columns", () => {
    expect(resolveBannerChoice({ kind: "image" }, ctx)).toEqual({ kind: "image", videoId: null, startSeconds: null, endSeconds: null, ambientId: null });
  });
  it("video_segment: keeps a 3-6 s segment of the caller's own READY video", () => {
    expect(resolveBannerChoice({ kind: "video_segment", videoId: own.id, startSeconds: 10, endSeconds: 14 }, ctx)).toEqual({ kind: "video_segment", videoId: own.id, startSeconds: 10, endSeconds: 14, ambientId: null });
  });
  it("ambient: needs an id of the manifest", () => {
    expect(AMBIENT_BANNERS.length).toBe(0); // the loops wait for the GPU slot; the kind is wired and tested already
    expect(() => resolveBannerChoice({ kind: "ambient", ambientId: "nope" }, ctx)).toThrow(/ambient/i);
    expect(resolveBannerChoice({ kind: "ambient", ambientId: "silk-loop" }, ctx, [{ id: "silk-loop" }])).toEqual({ kind: "ambient", videoId: null, startSeconds: null, endSeconds: null, ambientId: "silk-loop" });
  });
});

describe("the segment is bounded to 3-6 s", () => {
  const ctx = { userId: "u1", video: own };
  const seg = (startSeconds: number, endSeconds: number) => () => resolveBannerChoice({ kind: "video_segment", videoId: own.id, startSeconds, endSeconds }, ctx);
  it("constants", () => {
    expect([SEGMENT_MIN_SECONDS, SEGMENT_MAX_SECONDS]).toEqual([3, 6]);
  });
  it("accepts exactly 3 s and exactly 6 s", () => {
    expect(seg(0, 3)).not.toThrow();
    expect(seg(20, 26)).not.toThrow();
  });
  it("refuses 2.9 s, 6.1 s, a negative start and an end before the start", () => {
    expect(seg(0, 2.9)).toThrow(/3/);
    expect(seg(0, 6.1)).toThrow(/6/);
    expect(seg(-1, 4)).toThrow();
    expect(seg(10, 8)).toThrow();
  });
  it("refuses a segment that runs past the end of the video", () => {
    expect(seg(88, 93)).toThrow(/duration|end/i);
  });
});

describe("whose video, in which state", () => {
  const choice = { kind: "video_segment" as const, videoId: own.id, startSeconds: 1, endSeconds: 5 };
  it("refuses someone else's video, an unfinished one, a removed one and a missing one", () => {
    expect(() => resolveBannerChoice(choice, { userId: "u2", video: own })).toThrow(/your own/i);
    expect(() => resolveBannerChoice(choice, { userId: "u1", video: { ...own, status: "PROCESSING" } })).toThrow(/published/i);
    expect(() => resolveBannerChoice(choice, { userId: "u1", video: { ...own, removedAt: new Date() } })).toThrow(/published/i);
    expect(() => resolveBannerChoice(choice, { userId: "u1", video: { ...own, visibility: "CONTACTS_ONLY" } })).toThrow(/public/i);
    expect(() => resolveBannerChoice(choice, { userId: "u1", video: { ...own, minTipAmountCents: 500 } })).toThrow(/free/i);
    expect(() => resolveBannerChoice(choice, { userId: "u1", video: null })).toThrow(/video/i);
  });
});

describe("playback: a poster unless everything allows motion", () => {
  const ok = { reducedMotion: false, saveData: false, effectiveType: "4g", visible: true, tabVisible: true, surface: "profile" as const };
  it("plays on the profile page when visible, on a fast link, motion allowed", () => {
    expect(bannerPlayback(ok)).toBe("play");
  });
  it("falls back to the poster under reduced motion", () => {
    expect(bannerPlayback({ ...ok, reducedMotion: true })).toBe("poster");
  });
  it("falls back to the poster under Save-Data and on slow connections", () => {
    expect(bannerPlayback({ ...ok, saveData: true })).toBe("poster");
    expect(bannerPlayback({ ...ok, effectiveType: "2g" })).toBe("poster");
    expect(bannerPlayback({ ...ok, effectiveType: "slow-2g" })).toBe("poster");
    expect(bannerPlayback({ ...ok, effectiveType: "3g" })).toBe("poster");
  });
  it("is a poster when off screen, in a hidden tab, and always in lists and cards", () => {
    expect(bannerPlayback({ ...ok, visible: false })).toBe("poster");
    expect(bannerPlayback({ ...ok, tabVisible: false })).toBe("poster");
    expect(bannerPlayback({ ...ok, surface: "card" })).toBe("poster");
    expect(bannerPlayback({ ...ok, surface: "list" })).toBe("poster");
  });
  it("treats an unknown connection type as fine (desktop browsers do not report one)", () => {
    expect(bannerPlayback({ ...ok, effectiveType: undefined })).toBe("play");
  });
});
