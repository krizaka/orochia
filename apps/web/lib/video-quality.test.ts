import { describe, expect, it } from "vitest";

import { aspectLabel, qualityOf } from "./video-quality";

describe("video quality, from what Bunny encoded", () => {
  it("badges only what is really above HD: 4K from 2160, QHD 1440p from 1440, Full HD 1080p from 1080", () => {
    expect(qualityOf(null, 3840, 2160)).toEqual({ tier: "4K", lines: 2160, label: "4K" });
    expect(qualityOf(null, 2560, 1440)).toEqual({ tier: "QHD", lines: 1440, label: "QHD 1440p" });
    expect(qualityOf(null, 1920, 1080)).toEqual({ tier: "FHD", lines: 1080, label: "Full HD 1080p" });
  });
  it("never badges anything below 1080p: 720p is not HD, 480p is not worth a badge", () => {
    for (const [w, h] of [[1280, 720], [832, 480], [1280, 704], [704, 1280], [1280, 960], [640, 360]] as const) expect(qualityOf(null, w, h)).toBeNull();
    expect(qualityOf(["720p", "480p"])).toBeNull();
  });
  it("each threshold, with the slack of encoders that round to a multiple of 16", () => {
    expect(qualityOf(null, 1920, 1071)).toBeNull();
    expect(qualityOf(null, 1920, 1072)?.tier).toBe("FHD");
    expect(qualityOf(null, 2560, 1423)?.tier).toBe("FHD");
    expect(qualityOf(null, 2560, 1424)?.tier).toBe("QHD");
    expect(qualityOf(null, 3840, 2143)?.tier).toBe("QHD");
    expect(qualityOf(null, 3840, 2144)?.tier).toBe("4K");
  });
  it("a vertical file is judged by its short side too", () => {
    expect(qualityOf(null, 1080, 1920)?.label).toBe("Full HD 1080p");
    expect(qualityOf(null, 720, 1280)).toBeNull();
  });
  it("gives the same answer whether or not the list carries the renditions", () => {
    for (const [w, h] of [[1280, 704], [1920, 1080], [2560, 1440]] as const) expect(qualityOf(["1080p", "720p"], w, h)).toEqual(qualityOf(null, w, h));
  });
  it("without a size, falls back to the best rendition", () => {
    expect(qualityOf(["1440p", "1080p"])?.label).toBe("QHD 1440p");
    expect(qualityOf(["2160p", "1080p"])?.label).toBe("4K");
  });
  it("says nothing while nothing is known", () => {
    expect(qualityOf(null, null, null)).toBeNull();
    expect(qualityOf([], 0, 0)).toBeNull();
  });
  it("names the shape of the picture", () => {
    expect(aspectLabel(832, 480)).toBe("16:9");
    expect(aspectLabel(480, 832)).toBe("9:16");
    expect(aspectLabel(1080, 1080)).toBe("1:1");
    expect(aspectLabel(1080, 1350)).toBe("4:5");
    expect(aspectLabel(0, 0)).toBeNull();
  });
});
