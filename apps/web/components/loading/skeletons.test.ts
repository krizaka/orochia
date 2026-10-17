import { describe, expect, it, vi } from "vitest";

import { serverHtmlIn } from "@/lib/i18n-test-utils";

import { BlocksSkeleton, FeedSkeleton, ProfileSkeleton, WatchSkeleton } from "./skeletons";

vi.mock("@/lib/i18n-server", () => import("@/lib/i18n-test-server"));

const html = <P,>(component: (props: P) => Promise<React.ReactElement | null> | React.ReactElement | null, props: P) => serverHtmlIn("en", component, props);
const count = (s: string, needle: RegExp) => (s.match(needle) ?? []).length;

describe("loading states", () => {
  it("the feed draws the real card frames: 4 clips on a 9:16 shelf, 8 cards in a 16:9 grid", async () => {
    const out = await html(FeedSkeleton, {});
    expect(count(out, /data-skeleton="video-card"[^>]*data-aspect="portrait"/g)).toBe(4);
    expect(count(out, /data-skeleton="video-card"[^>]*data-aspect="landscape"/g)).toBe(8);
  });

  it("each route announces its wait once, in words, and hides its shapes", async () => {
    for (const out of [await html(FeedSkeleton, {}), await html(WatchSkeleton, {}), await html(ProfileSkeleton, {}), await html(BlocksSkeleton, { label: "Loading your insights" })]) {
      expect(count(out, /role="status"/g)).toBe(1);
      expect(out).toContain('aria-busy="true"');
      expect(out).not.toMatch(/<(img|video)\b/);
    }
  });

  it("the watch page keeps the 16:9 player box, so the page does not jump when the video arrives", async () => {
    expect(await html(WatchSkeleton, {})).toContain("aspect-video");
  });
});
