import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { encodeFeedCursor, FEED_PAGE_SIZE, FeedSort, pageOf, parseFeedCursor, rankedSlice } from "./feed-cursor";

const ID = "6b1f5c2e-2d1a-4f3b-9a55-0d2f6a1e9c10";
const row = (n: number) => ({ id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, title: `v${n}`, cursorKey: `2026-10-16 20:00:00.${String(1000 - n).padStart(6, "0")}+00` });

describe("feed cursor", () => {
  it("round-trips, keeping the microseconds of a timestamp (a millisecond would skip or repeat a video)", () => {
    const key = "2026-10-16 20:03:11.123456+00";
    const raw = encodeFeedCursor({ sort: FeedSort.Latest, key, id: ID });
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/); // opaque and URL-safe
    expect(parseFeedCursor(raw, FeedSort.Latest)).toEqual({ sort: FeedSort.Latest, key, id: ID });
  });

  it("is absent for the first page", () => {
    expect(parseFeedCursor(undefined, FeedSort.Latest)).toBeNull();
    expect(parseFeedCursor("", FeedSort.Latest)).toBeNull();
  });

  it("refuses a cursor made for another feed, garbage, and anything that is not a key (nothing reaches the SQL)", () => {
    const trending = encodeFeedCursor({ sort: FeedSort.Trending, key: "1200", id: ID });
    expect(() => parseFeedCursor(trending, FeedSort.Latest)).toThrow(ZodError);
    expect(() => parseFeedCursor("not-a-cursor", FeedSort.Latest)).toThrow(ZodError);
    const evil = Buffer.from(JSON.stringify({ s: "latest", k: "'; drop table videos; --", id: ID })).toString("base64url");
    expect(() => parseFeedCursor(evil, FeedSort.Latest)).toThrow(ZodError);
    const badId = Buffer.from(JSON.stringify({ s: "latest", k: "2026-10-16 20:00:00+00", id: "1 or 1=1" })).toString("base64url");
    expect(() => parseFeedCursor(badId, FeedSort.Latest)).toThrow(ZodError);
    expect(() => parseFeedCursor("x".repeat(400), FeedSort.Latest)).toThrow(ZodError);
  });

  it("a trending key is a view count", () => {
    expect(parseFeedCursor(encodeFeedCursor({ sort: FeedSort.Trending, key: "42", id: ID }), FeedSort.Trending)?.key).toBe("42");
    const bad = Buffer.from(JSON.stringify({ s: "trending", k: "4 2", id: ID })).toString("base64url");
    expect(() => parseFeedCursor(bad, FeedSort.Trending)).toThrow(ZodError);
  });
});

describe("pageOf", () => {
  it("asks one row more than the page, never shows it, and points the cursor at the last row shown", () => {
    const rows = Array.from({ length: FEED_PAGE_SIZE + 1 }, (_, i) => row(i));
    const page = pageOf(rows, FEED_PAGE_SIZE, FeedSort.Latest);
    expect(page.items).toHaveLength(FEED_PAGE_SIZE);
    expect(page.items[0]).not.toHaveProperty("cursorKey");
    const next = parseFeedCursor(page.nextCursor, FeedSort.Latest);
    expect(next).toEqual({ sort: FeedSort.Latest, key: rows[FEED_PAGE_SIZE - 1]!.cursorKey, id: rows[FEED_PAGE_SIZE - 1]!.id });
  });

  it("has no next cursor on the last page, full or not", () => {
    expect(pageOf([row(1), row(2)], FEED_PAGE_SIZE, FeedSort.Latest)).toMatchObject({ nextCursor: null });
    expect(pageOf(Array.from({ length: FEED_PAGE_SIZE }, (_, i) => row(i)), FEED_PAGE_SIZE, FeedSort.Latest).nextCursor).toBeNull();
    expect(pageOf([], FEED_PAGE_SIZE, FeedSort.Latest)).toEqual({ items: [], nextCursor: null });
  });
});

describe("rankedSlice (For you and Trending are ranked lists)", () => {
  const pool = Array.from({ length: 7 }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }));
  it("walks the whole list once, page by page, through the cursor", () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let guard = 0; guard < 10; guard++) {
      const offset: number = Number(parseFeedCursor(cursor, FeedSort.ForYou)?.key ?? 0);
      const page: { items: { id: string }[]; nextCursor: string | null } = rankedSlice(pool, offset, 3, FeedSort.ForYou);
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual(pool.map((p) => p.id));
  });
  it("its cursor is bound to its feed", () => {
    const { nextCursor } = rankedSlice(pool, 0, 3, FeedSort.ForYou);
    expect(() => parseFeedCursor(nextCursor, FeedSort.Trending)).toThrow(ZodError);
  });
  it("an empty or exhausted list has no next page", () => {
    expect(rankedSlice([], 0, 3, FeedSort.Trending)).toEqual({ items: [], nextCursor: null });
    expect(rankedSlice(pool, 5, 3, FeedSort.Trending).nextCursor).toBeNull();
  });
});
