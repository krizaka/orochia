import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { htmlIn } from "@/lib/i18n-test-utils";

import { BlocksSkeleton, FeedSkeleton, ProfileSkeleton, WatchSkeleton } from "./skeletons";

const html = <P extends object>(component: React.ComponentType<P>, props: P) => htmlIn("en", createElement(component as React.ComponentType<object>, props));
const count = (s: string, needle: RegExp) => (s.match(needle) ?? []).length;

describe("loading states", () => {
  it("the feed draws the real card frames: 4 clips on a 9:16 shelf, 8 cards in a 16:9 grid", () => {
    const out = html(FeedSkeleton, {});
    expect(count(out, /data-skeleton="video-card"[^>]*data-aspect="portrait"/g)).toBe(4);
    expect(count(out, /data-skeleton="video-card"[^>]*data-aspect="landscape"/g)).toBe(8);
  });

  it("each route announces its wait once, in words, and hides its shapes", () => {
    for (const out of [html(FeedSkeleton, {}), html(WatchSkeleton, {}), html(ProfileSkeleton, {}), html(BlocksSkeleton, { label: "Loading your insights" })]) {
      expect(count(out, /role="status"/g)).toBe(1);
      expect(out).toContain('aria-busy="true"');
      expect(out).not.toMatch(/<(img|video)\b/);
    }
  });

  it("the watch page keeps the 16:9 player box, so the page does not jump when the video arrives", () => {
    expect(html(WatchSkeleton, {})).toContain("aspect-video");
  });
});
