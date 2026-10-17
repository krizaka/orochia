import { z } from "zod";

/**
 * The keyset (cursor) pagination of the feeds. A page is read from our database — never from Bunny's list API, and never
 * the whole library: one page is `FEED_PAGE_SIZE` rows, the cursor says where the last one stood. The cursor is opaque to
 * clients (base64url JSON) and parsed at the edge: nothing but a timestamp or a count and a uuid ever reaches the SQL.
 */

// @fixed: the size of one page of the home feed (a screenful and a half, one indexed range read)
export const FEED_PAGE_SIZE = 24;
// @fixed: the most a client may ask for in one page, so no request lists the library
export const FEED_PAGE_MAX = 48;

export const FeedSort = { Latest: "latest", Trending: "trending", Following: "following" } as const;
export type FeedSort = (typeof FeedSort)[keyof typeof FeedSort];
export const FEED_SORTS = Object.values(FeedSort) as [FeedSort, ...FeedSort[]];

export interface FeedCursor {
  sort: FeedSort;
  /** The sort key of the last row shown: its `created_at` as Postgres prints it (microseconds kept), or its views count. */
  key: string;
  id: string;
}

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;
const COUNT = /^\d{1,12}$/;

const Body = z.object({ s: z.enum(FEED_SORTS), k: z.string().max(40), id: z.string().uuid() });

export function encodeFeedCursor({ sort, key, id }: FeedCursor): string {
  return Buffer.from(JSON.stringify({ s: sort, k: key, id })).toString("base64url");
}

/** The cursor of a request for `sort`, or null for the first page. Throws a ZodError (answered 400) on anything else. */
export function parseFeedCursor(raw: string | null | undefined, sort: FeedSort): FeedCursor | null {
  if (!raw) return null;
  const text = z.string().max(300).regex(/^[A-Za-z0-9_-]+$/).parse(raw);
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(text, "base64url").toString("utf8"));
  } catch {
    throw new z.ZodError([{ code: "custom", message: "Invalid cursor", path: ["cursor"] }]);
  }
  const body = Body.parse(json);
  const keyShape = sort === FeedSort.Trending ? COUNT : TIMESTAMP;
  return z
    .object({ sort: z.literal(sort), key: z.string().regex(keyShape), id: z.string().uuid() })
    .parse({ sort: body.s, key: body.k, id: body.id });
}

/** A page from `limit + 1` rows: the extra one only says there is more. */
export function pageOf<T extends { id: string; cursorKey: string }>(rows: readonly T[], limit: number, sort: FeedSort): { items: Omit<T, "cursorKey">[]; nextCursor: string | null } {
  const shown = rows.slice(0, limit);
  const last = shown[shown.length - 1];
  const items = shown.map(({ cursorKey: _key, ...rest }) => rest);
  return { items, nextCursor: rows.length > limit && last ? encodeFeedCursor({ sort, key: last.cursorKey, id: last.id }) : null };
}
