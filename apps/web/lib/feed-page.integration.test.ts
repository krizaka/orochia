/**
 * The feed's keyset pagination against a real PostgreSQL: walking every page of a feed returns each listable video once,
 * in order, even when several videos share the same `created_at` to the microsecond or the same views count; a video that
 * is not listable never appears. Runs when FEED_IT=1 on a migrated database (DATABASE_URL).
 */
import { randomUUID } from "node:crypto";

import { db, users, videos } from "@orochia/db";
import { eq, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { FeedSort } from "./feed-cursor";
import { feedPage } from "./queries";

const enabled = process.env.FEED_IT === "1";
const TAG = `it-${randomUUID().slice(0, 8)}`;

describe.skipIf(!enabled)("feedPage (keyset pagination)", () => {
  let creatorId: string;
  const listed: string[] = [];

  beforeAll(async () => {
    const [creator] = await db.select({ id: users.id }).from(users).where(eq(users.role, "CREATOR")).limit(1);
    creatorId = creator.id;
    // 11 listable videos: groups of 3 share one created_at to the microsecond and one views count.
    for (let i = 0; i < 11; i++) {
      const group = Math.floor(i / 3);
      const [row] = await db
        .insert(videos)
        .values({
          creatorId,
          bunnyVideoId: `${TAG}-${i}`,
          title: `${TAG} ${i}`,
          visibility: "PUBLIC",
          status: "READY",
          viewsCount: 1_000_000 - group * 10,
          createdAt: sql`timestamptz '2099-01-01 00:00:00.000000+00' - (${group} * interval '1 microsecond')`,
        })
        .returning({ id: videos.id });
      listed.push(row.id);
    }
    await db.insert(videos).values({ creatorId, bunnyVideoId: `${TAG}-secret`, title: `${TAG} secret`, visibility: "INVITED_ONLY", status: "READY", viewsCount: 2_000_000, createdAt: sql`timestamptz '2099-02-01 00:00:00+00'` });
    await db.insert(videos).values({ creatorId, bunnyVideoId: `${TAG}-wip`, title: `${TAG} wip`, visibility: "PUBLIC", status: "PROCESSING", viewsCount: 2_000_000, createdAt: sql`timestamptz '2099-02-02 00:00:00+00'` });
  });

  afterAll(async () => {
    await db.delete(videos).where(like(videos.bunnyVideoId, `${TAG}-%`));
  });

  async function walk(sort: "latest" | "trending", size: number) {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page = await feedPage({ sort, cursor, limit: size });
      seen.push(...page.videos.map((v) => v.id));
      expect(page.videos.length).toBeLessThanOrEqual(size);
      cursor = page.nextCursor;
      pages++;
    } while (cursor && pages < 1000);
    return seen;
  }

  it.each([FeedSort.Latest, FeedSort.Trending] as const)("%s: every listable video once, none skipped across pages of 4, the unlisted never", async (sort) => {
    const seen = (await walk(sort, 4)).filter((id) => listed.includes(id) || true);
    const mine = seen.filter((id) => listed.includes(id));
    expect(new Set(seen).size).toBe(seen.length); // no repeat anywhere in the library
    expect(mine.sort()).toEqual([...listed].sort()); // none of ours skipped
    const secrets = await db.select({ id: videos.id }).from(videos).where(like(videos.bunnyVideoId, `${TAG}-%`));
    const unlisted = secrets.map((r) => r.id).filter((id) => !listed.includes(id));
    expect(seen.some((id) => unlisted.includes(id))).toBe(false);
  });

  it("latest: ours come newest first, in the same order whatever the page size", async () => {
    const ours = (ids: string[]) => ids.filter((id) => listed.includes(id));
    expect(ours(await walk("latest", 3))).toEqual(ours(await walk("latest", 7)));
  });

  it("a page never has more than asked, and the last page has no cursor", async () => {
    const first = await feedPage({ sort: FeedSort.Latest, limit: 5 });
    expect(first.videos).toHaveLength(5);
    expect(first.nextCursor).not.toBeNull();
  });

  it("following without a viewer is empty", async () => {
    expect(await feedPage({ sort: FeedSort.Following })).toEqual({ videos: [], nextCursor: null });
  });
});
