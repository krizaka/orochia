import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BlocksSkeleton, FeedSkeleton, ProfileSkeleton, WatchSkeleton } from "./skeletons";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const count = (s: string, needle: RegExp) => (s.match(needle) ?? []).length;

describe("loading states", () => {
  it("the feed draws the real card frames: 4 clips on a 9:16 shelf, 8 cards in a 16:9 grid", () => {
    const out = html(createElement(FeedSkeleton));
    expect(count(out, /data-skeleton="video-card"[^>]*data-aspect="portrait"/g)).toBe(4);
    expect(count(out, /data-skeleton="video-card"[^>]*data-aspect="landscape"/g)).toBe(8);
  });

  it("each route announces its wait once, in words, and hides its shapes", () => {
    for (const el of [createElement(FeedSkeleton), createElement(WatchSkeleton), createElement(ProfileSkeleton), createElement(BlocksSkeleton, { label: "Loading your insights" })]) {
      const out = html(el);
      expect(count(out, /role="status"/g)).toBe(1);
      expect(out).toContain('aria-busy="true"');
      expect(out).not.toMatch(/<(img|video)\b/);
    }
  });

  it("the watch page keeps the 16:9 player box, so the page does not jump when the video arrives", () => {
    expect(html(createElement(WatchSkeleton))).toContain("aspect-video");
  });
});
