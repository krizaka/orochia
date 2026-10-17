import { describe, expect, it } from "vitest";

import { FeedLayout, feedLayoutOf, mayStream, viewSearch } from "./feed-view";

describe("the home feed's layout", () => {
  it("a phone gets the vertical feed by default, the grid when the address asks for it", () => {
    expect(feedLayoutOf({ phone: true, view: null })).toBe(FeedLayout.Vertical);
    expect(feedLayoutOf({ phone: true, view: "grid" })).toBe(FeedLayout.Grid);
    expect(feedLayoutOf({ phone: true, view: "nonsense" })).toBe(FeedLayout.Vertical);
  });
  it("a tablet or a desktop keeps the grid, whatever the address says", () => {
    expect(feedLayoutOf({ phone: false, view: null })).toBe(FeedLayout.Grid);
    expect(feedLayoutOf({ phone: false, view: "vertical" })).toBe(FeedLayout.Grid);
  });
  it("the layout lives in the address and keeps the other parameters", () => {
    expect(viewSearch(new URLSearchParams("feed=trending"), FeedLayout.Grid).toString()).toBe("feed=trending&view=grid");
    expect(viewSearch(new URLSearchParams("feed=trending&view=grid"), FeedLayout.Vertical).toString()).toBe("feed=trending");
  });
  it("no video is loaded under Save-Data or reduced motion: posters only", () => {
    expect(mayStream({ saveData: false, reducedMotion: false })).toBe(true);
    expect(mayStream({ saveData: true, reducedMotion: false })).toBe(false);
    expect(mayStream({ saveData: false, reducedMotion: true })).toBe(false);
  });
});
