import { describe, expect, it } from "vitest";

import { aspectLabel, qualityOf } from "./video-quality";

describe("video quality, from what Bunny encoded", () => {
  it("takes the best rendition, named by the short side", () => {
    expect(qualityOf(["360p", "480p", "240p"], 832, 480)).toEqual({ tier: "SD", lines: 480, label: "SD 480p" });
    expect(qualityOf(["720p", "480p"], 1280, 720)?.label).toBe("HD 720p");
    expect(qualityOf(["1080p"], 1920, 1080)?.label).toBe("HD 1080p");
    expect(qualityOf(["1440p"])?.label).toBe("2K 1440p");
    expect(qualityOf(["2160p", "1080p"])?.label).toBe("4K 2160p");
  });
  it("a vertical clip is judged by its short side too", () => {
    expect(qualityOf(["480p"], 480, 832)?.label).toBe("SD 480p");
    expect(qualityOf(null, 720, 1280)?.label).toBe("HD 720p");
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
