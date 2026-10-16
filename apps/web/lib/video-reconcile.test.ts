import { describe, expect, it } from "vitest";

import { isBunnyGuid, needsReconcile, videoMediaFromBunny } from "./video-reconcile";

const GUID = "27888aeb-32a2-45ac-b9bc-444ed11f1696";
const HOST = "vz-test.b-cdn.net";

describe("video media read back from Bunny (the webhook may never come)", () => {
  it("gives a finished video its poster, preview, length, size and renditions", () => {
    const patch = videoMediaFromBunny(
      { length: 4.6, storageSize: 2406212, availableResolutions: "240p,360p,480p", thumbnailFileName: "thumbnail_1.jpg" },
      HOST,
      GUID,
    );
    expect(patch).toEqual({
      thumbnailUrl: `https://${HOST}/${GUID}/thumbnail_1.jpg`,
      previewAnimationUrl: `https://${HOST}/${GUID}/preview.webp`,
      durationSeconds: 5,
      storageBytes: 2406212,
      resolutions: ["240p", "360p", "480p"],
      width: null,
      height: null,
      framerate: null,
    });
  });

  it("keeps the source size so a vertical clip stays vertical", () => {
    const patch = videoMediaFromBunny({ length: 6, storageSize: 1, availableResolutions: "480p", width: 540, height: 960 }, HOST, GUID);
    expect([patch.width, patch.height]).toEqual([540, 960]);
  });

  it("keeps the real frame rate Bunny read from the file", () => {
    expect(videoMediaFromBunny({ length: 5, storageSize: 1, framerate: 16.004 }, HOST, GUID).framerate).toBe(16.004);
    expect(videoMediaFromBunny({ length: 5, storageSize: 1, framerate: 0 }, HOST, GUID).framerate).toBeNull();
  });

  it("falls back to thumbnail.jpg when Bunny names no thumbnail", () => {
    const patch = videoMediaFromBunny({ length: 6, storageSize: 1, availableResolutions: "" }, HOST, GUID);
    expect(patch.thumbnailUrl).toBe(`https://${HOST}/${GUID}/thumbnail.jpg`);
    expect(patch.resolutions).toEqual([]);
  });

  it("recognises a real Bunny guid and refuses a placeholder id", () => {
    expect(isBunnyGuid(GUID)).toBe(true);
    expect(isBunnyGuid("qa-explorer-03")).toBe(false);
  });

  it("asks Bunny about a video that is unsettled or online without a poster, not about the settled ones", () => {
    expect(needsReconcile({ status: "READY", thumbnailUrl: null, bunnyVideoId: GUID })).toBe(true);
    expect(needsReconcile({ status: "PROCESSING", thumbnailUrl: null, bunnyVideoId: GUID })).toBe(true);
    expect(needsReconcile({ status: "PENDING_UPLOAD", thumbnailUrl: null, bunnyVideoId: GUID })).toBe(true);
    expect(needsReconcile({ status: "READY", thumbnailUrl: "https://x/y.jpg", width: null, bunnyVideoId: GUID })).toBe(true);
    expect(needsReconcile({ status: "READY", thumbnailUrl: "https://x/y.jpg", width: 540, framerate: 24, bunnyVideoId: GUID })).toBe(false);
    expect(needsReconcile({ status: "READY", thumbnailUrl: "https://x/y.jpg", width: 540, framerate: null, bunnyVideoId: GUID })).toBe(true);
    expect(needsReconcile({ status: "READY", thumbnailUrl: null, bunnyVideoId: "qa-explorer-03" })).toBe(false);
    expect(needsReconcile({ status: "FAILED", thumbnailUrl: null, bunnyVideoId: GUID })).toBe(false);
  });
});
