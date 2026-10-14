import { describe, expect, it } from "vitest";

import { CREATOR_CLIPS, FAN_CLIPS, SHOWCASE_CLIP, siteMedia, type TourClip, tourRecording } from "./site-media";

describe("site recordings", () => {
  it("point at the Bunny CDN with a content hash in the name", () => {
    expect(siteMedia("products/orochia/tour/alex-bid.mp4")).toMatch(/^https:\/\/krizaka-assets\.b-cdn\.net\/site\/products\/orochia\/tour\/alex-bid\.[0-9a-f]{10}\.mp4$/);
  });

  it("know every clip of the tour in its three files", () => {
    const ids: TourClip[] = [...FAN_CLIPS, ...CREATOR_CLIPS, SHOWCASE_CLIP];
    for (const id of ids) {
      const r = tourRecording(id);
      expect([r.webm, r.mp4, r.poster].every((u) => u.startsWith("https://"))).toBe(true);
    }
  });

  it("refuses a path it does not know", () => {
    expect(() => siteMedia("products/orochia/tour/nope.mp4")).toThrow();
  });
});
