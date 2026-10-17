import { describe, expect, it } from "vitest";

import { aspectClassOf, formatOf, frameOf, orientationOf, tileFitOf } from "./video-aspect";

describe("video orientation", () => {
  it("keeps 9:16 and 4:5 vertical, 1:1 square, 16:9 horizontal", () => {
    expect(orientationOf(1080, 1920)).toBe("vertical");
    expect(orientationOf(540, 960)).toBe("vertical");
    expect(orientationOf(1080, 1350)).toBe("vertical");
    expect(orientationOf(1080, 1080)).toBe("square");
    expect(orientationOf(1920, 1080)).toBe("horizontal");
    expect(orientationOf(960, 540)).toBe("horizontal");
  });
  it("an unknown size is horizontal, as before", () => {
    expect(orientationOf(null, null)).toBe("horizontal");
    expect(orientationOf(0, 0)).toBe("horizontal");
    expect(orientationOf(undefined, 1080)).toBe("horizontal");
  });
  it("gives each orientation its own box, never 16:9 for a vertical clip", () => {
    expect(aspectClassOf(540, 960)).toBe("aspect-[9/16]");
    expect(aspectClassOf(1080, 1080)).toBe("aspect-square");
    expect(aspectClassOf(1920, 1080)).toBe("aspect-video");
  });
  it("routes a feed: verticals to the Shorts shelf, everything else to the 16:9 grid", () => {
    expect(frameOf(480, 832)).toBe("portrait");
    expect(frameOf(1080, 1350)).toBe("portrait");
    expect(frameOf(832, 480)).toBe("landscape");
    expect(frameOf(1080, 1080)).toBe("landscape");
    expect(frameOf(null, null)).toBe("landscape");
  });
});

describe("the format rule (one function)", () => {
  it("9:16 is a Short, 1:1 and 16:9 are Videos", () => {
    expect(formatOf(1080, 1920, 30, 180)).toBe("short");
    expect(formatOf(1080, 1080, 30, 180)).toBe("video");
    expect(formatOf(1920, 1080, 30, 180)).toBe("video");
    expect(formatOf(null, null, 30, 180)).toBe("video");
  });
  it("a vertical clip longer than the Shorts limit is a Video", () => {
    expect(formatOf(1080, 1920, 180, 180)).toBe("short");
    expect(formatOf(1080, 1920, 181, 180)).toBe("video");
  });
  it("frameOf follows the format: the shelf for Shorts only", () => {
    expect(frameOf(1080, 1920, 60, 180)).toBe("portrait");
    expect(frameOf(1080, 1920, 600, 180)).toBe("landscape");
    expect(frameOf(1080, 1080, 600, 180)).toBe("landscape");
  });
});

describe("tile fit", () => {
  it("a square clip fills its 16:9 tile, centred — no grey side bars", () => {
    expect(tileFitOf(1080, 1080, "landscape")).toBe("cover");
    expect(tileFitOf(1920, 1080, "landscape")).toBe("cover");
    expect(tileFitOf(1080, 1920, "portrait")).toBe("cover");
  });
  it("a long vertical clip in a 16:9 tile is shown whole, not cropped to a slice", () => {
    expect(tileFitOf(1080, 1920, "landscape")).toBe("contain");
  });
});
