import { describe, expect, it } from "vitest";

import { aspectLabel, qualityOf } from "./video-quality";

describe("video quality, from what Bunny encoded", () => {
  it("is judged by the short side of the real file, with thresholds 700 / 1000 / 2000", () => {
    expect(qualityOf(null, 832, 480)).toEqual({ tier: "SD", lines: 480, label: "SD 480p" });
    expect(qualityOf(null, 1280, 720)?.label).toBe("HD 720p");
    expect(qualityOf(null, 1920, 1080)?.label).toBe("Full HD 1080p");
    expect(qualityOf(null, 3840, 2160)?.label).toBe("4K 2160p");
    expect(qualityOf(null, 2560, 1440)?.label).toBe("Full HD 1080p");
  });
  it("Wan's 1280x704 and 704x1280 are HD 720p, never SD 704p", () => {
    expect(qualityOf(null, 1280, 704)?.label).toBe("HD 720p");
    expect(qualityOf(null, 704, 1280)?.label).toBe("HD 720p");
    expect(qualityOf(["720p"], 704, 1280)).toEqual(qualityOf(null, 704, 1280));
    expect(qualityOf(null, 699, 1280)?.tier).toBe("SD");
    expect(qualityOf(null, 700, 1280)?.tier).toBe("HD");
  });
  it("gives the same answer whether or not the list carries the renditions", () => {
    for (const [w, h] of [[1280, 704], [832, 480], [1920, 1080], [704, 1280]] as const) expect(qualityOf(["720p", "480p"], w, h)).toEqual(qualityOf(null, w, h));
  });
  it("a vertical clip is judged by its short side too", () => {
    expect(qualityOf(["480p"], 480, 832)?.label).toBe("SD 480p");
  });
  it("without a size, falls back to the best rendition", () => {
    expect(qualityOf(["720p", "480p"])?.label).toBe("HD 720p");
    expect(qualityOf(["2160p", "1080p"])?.label).toBe("4K 2160p");
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
