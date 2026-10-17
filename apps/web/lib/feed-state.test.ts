import { describe, expect, it } from "vitest";

import { feedReducer, feedStateOf, type FeedStates, hasMore } from "./feed-state";

const v = (id: string) => ({ id });
const start = (): FeedStates<{ id: string }> => feedStateOf("latest", { videos: [v("a"), v("b")], nextCursor: "c1" });

describe("feed state", () => {
  it("starts a tab from its server-rendered first page", () => {
    const s = start();
    expect(s.latest).toMatchObject({ status: "idle", nextCursor: "c1", loaded: true });
    expect(s.trending).toMatchObject({ videos: [], loaded: false, status: "idle", nextCursor: null });
  });

  it("appends the next page behind the first and moves the cursor", () => {
    let s = feedReducer(start(), { type: "request", tab: "latest" });
    expect(s.latest.status).toBe("loading");
    s = feedReducer(s, { type: "received", tab: "latest", page: { videos: [v("c"), v("d")], nextCursor: null } });
    expect(s.latest.videos.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    expect(s.latest).toMatchObject({ status: "idle", nextCursor: null });
    expect(hasMore(s.latest)).toBe(false);
  });

  it("never shows a video twice (a trending order can move between two pages)", () => {
    let s = feedReducer(start(), { type: "request", tab: "latest" });
    s = feedReducer(s, { type: "received", tab: "latest", page: { videos: [v("b"), v("c")], nextCursor: "c2" } });
    expect(s.latest.videos.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("a failed page keeps what is shown and the cursor, so the button retries the same page", () => {
    let s = feedReducer(start(), { type: "request", tab: "latest" });
    s = feedReducer(s, { type: "failed", tab: "latest" });
    expect(s.latest).toMatchObject({ status: "failed", nextCursor: "c1" });
    expect(s.latest.videos).toHaveLength(2);
    expect(hasMore(s.latest)).toBe(true);
  });

  it("a tab that was never loaded has more to ask for until its first page arrives", () => {
    const s = start();
    expect(hasMore(s.trending)).toBe(true);
    const got = feedReducer(s, { type: "received", tab: "trending", page: { videos: [], nextCursor: null } });
    expect(got.trending).toMatchObject({ loaded: true, nextCursor: null });
    expect(hasMore(got.trending)).toBe(false);
  });

  it("ignores a request while one is on its way (two scroll events, one page)", () => {
    const once = feedReducer(start(), { type: "request", tab: "latest" });
    expect(feedReducer(once, { type: "request", tab: "latest" })).toBe(once);
  });
});
