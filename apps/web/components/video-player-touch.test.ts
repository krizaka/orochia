import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// iPhone Safari (orochia#275): the player's controls must answer a tap. Guards on the source, the live proof is
// e2e/player-iphone.mjs (WebKit, iPhone profile, elementFromPoint at each control).
const src = readFileSync(join(__dirname, "VideoPlayer.tsx"), "utf8");

describe("VideoPlayer on a touch screen", () => {
  it("never calls requestFullscreen on the container by hand (missing on iPhone): it goes through toggleFullscreen", () => {
    expect(src).not.toMatch(/\.requestFullscreen\(/);
    expect(src).toMatch(/toggleFullscreen\(containerRef\.current, videoRef\.current\)/);
  });

  it("does not hide the controls on hover handlers (iOS swallows the first tap after a hover change)", () => {
    expect(src).not.toMatch(/onMouseEnter|onMouseLeave/);
  });

  it("keeps its play state in step with the media element (native pause, fullscreen, autoplay refusal)", () => {
    expect(src).toMatch(/onPlay=/);
    expect(src).toMatch(/onPause=/);
  });

  it("ends above the phone's fixed tab bar: a tall clip is sized under the header AND the bar (the bar covered the controls)", () => {
    expect(src).not.toMatch(/(?<!md:)max-h-\[calc\(100dvh-5rem\)\]"/);
    expect(src.match(/max-h-\[calc\(100dvh-13rem-env\(safe-area-inset-bottom\)\)\]/g)).toHaveLength(2);
  });
});
