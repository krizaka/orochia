import { describe, expect, it } from "vitest";

import { aspectClassOf, frameOf, orientationOf } from "./video-aspect";

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
