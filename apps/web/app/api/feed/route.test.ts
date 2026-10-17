import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeFeedCursor, FeedSort } from "@/lib/feed-cursor";

/** The route runs for real; the session and the queries are stand-ins. What is proven: what reaches the query. */
const queries = vi.hoisted(() => ({ feedPage: vi.fn(), searchVideos: vi.fn(async () => []), featuredCreator: vi.fn(async () => null), popularTags: vi.fn(async () => []) }));
const session = vi.hoisted(() => ({ user: null as null | { id: string; isAgeVerified: boolean } }));
vi.mock("@/lib/queries", () => queries);
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => session.user) }));

import { GET } from "./route";

const ID = "6b1f5c2e-2d1a-4f3b-9a55-0d2f6a1e9c10";
const get = (qs: string) => GET(new NextRequest(`https://dev.orochia.com/api/feed${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  session.user = null;
  queries.feedPage.mockResolvedValue({ videos: [], nextCursor: null });
});

describe("GET /api/feed paged", () => {
  it("answers a page and its next cursor, never the explore extras, and is not cached", async () => {
    queries.feedPage.mockResolvedValue({ videos: [{ id: ID }], nextCursor: "abc" });
    const res = await get("?sort=latest");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, videos: [{ id: ID }], nextCursor: "abc" });
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(queries.featuredCreator).not.toHaveBeenCalled();
    expect(queries.feedPage).toHaveBeenCalledWith({ sort: "latest", limit: 24, viewerId: undefined }, false);
  });

  it("passes the cursor and the age check of the viewer", async () => {
    session.user = { id: ID, isAgeVerified: true };
    const cursor = encodeFeedCursor({ sort: FeedSort.Trending, key: "10", id: ID });
    await get(`?sort=trending&cursor=${cursor}&limit=12`);
    expect(queries.feedPage).toHaveBeenCalledWith({ sort: "trending", cursor, limit: 12, viewerId: ID }, true);
  });

  it("caps a page: the library is never listed whole", async () => {
    expect((await get("?sort=latest&limit=500")).status).toBe(400);
    expect((await get("?sort=latest&limit=0")).status).toBe(400);
    expect(queries.feedPage).not.toHaveBeenCalled();
  });

  it("refuses an unknown feed and a following feed without a session", async () => {
    expect((await get("?sort=random")).status).toBe(400);
    expect((await get("?sort=following")).status).toBe(401);
    session.user = { id: ID, isAgeVerified: false };
    expect((await get("?sort=following")).status).toBe(200);
  });

  it("the explore search keeps its offset form", async () => {
    await get("?q=tea&limit=5&offset=10");
    expect(queries.searchVideos).toHaveBeenCalledWith({ q: "tea", limit: 5, offset: 10 }, false);
  });
});
