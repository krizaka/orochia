import { describe, expect, it } from "vitest";

import { FEED_RANK_DEFAULTS } from "./feed-ranking";
import { parseFeedSettings } from "./feed-settings";

describe("the feed settings (app_settings, domain feed)", () => {
  it("an unpublished domain means the defaults, N = 2 in a row", () => {
    expect(parseFeedSettings(undefined)).toEqual(FEED_RANK_DEFAULTS);
    expect(FEED_RANK_DEFAULTS.maxConsecutivePerCreator).toBe(2);
  });
  it("a version overrides only the keys it names", () => {
    const s = parseFeedSettings({ maxConsecutivePerCreator: 3 });
    expect(s.maxConsecutivePerCreator).toBe(3);
    expect(s.trendingShare).toBe(FEED_RANK_DEFAULTS.trendingShare);
  });
  it("a version outside the bounds is ignored whole", () => {
    expect(parseFeedSettings({ maxConsecutivePerCreator: 0, trendingShare: 0.9 })).toEqual(FEED_RANK_DEFAULTS);
    expect(parseFeedSettings({ trendingShare: 2 })).toEqual(FEED_RANK_DEFAULTS);
  });
});
