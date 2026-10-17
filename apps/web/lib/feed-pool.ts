import { db, users, videos } from "@orochia/db";
import { addSeconds, isAfter } from "date-fns";
import { desc, eq, inArray, type SQL } from "drizzle-orm";

import { type ExploreViewer, videoEngagement } from "./explore";
import { FeedSort } from "./feed-cursor";
import { blendFresh, type FeedCandidate, type FeedRankSettings, limitConsecutive, rankByVelocity, recencyRerank, velocityScores } from "./feed-ranking";
import { forYou } from "./recommendations/recommendations.shelves";

/**
 * The ranked candidates of the For you and Trending feeds (the ordering rules are lib/feed-ranking.ts, pure and tested).
 * A pool is computed once and its pages are slices of it, reused for `poolCacheSeconds` so one scroll sees one order.
 * Latest and Following are keyset pages on a column and never come through here.
 */
const holder = globalThis as unknown as { __orochiaFeedPools?: Map<string, { pool: FeedCandidate[]; until: Date }> };
// @fixed: a technical bound on the cache (one entry per feed and viewer), not a business parameter
const MAX_ENTRIES = 500;

async function fresh(scope: SQL, size: number): Promise<FeedCandidate[]> {
  return db
    .select({ id: videos.id, creatorId: videos.creatorId, createdAt: videos.createdAt })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .where(scope)
    .orderBy(desc(videos.createdAt), desc(videos.id))
    .limit(size);
}

async function trending(scope: SQL, settings: FeedRankSettings, now: Date): Promise<FeedCandidate[]> {
  const buckets = await videoEngagement(scope, Math.ceil(settings.velocityWindowHours / 24) + 1);
  const candidates = new Map<string, FeedCandidate>();
  for (const b of buckets) candidates.set(b.itemId, { id: b.itemId, creatorId: b.creatorId, createdAt: b.createdAt });
  return rankByVelocity([...candidates.values()], velocityScores(buckets, now, settings));
}

/** Orazaka's For you for a signed-in viewer (its own fallback when it is off or slow), in Orazaka's order. */
async function recommended(viewer: ExploreViewer, now: Date): Promise<FeedCandidate[]> {
  const shelf = await forYou(viewer, now);
  if (shelf.videos.length === 0) return [];
  const rows = await db
    .select({ id: videos.id, creatorId: videos.creatorId, createdAt: videos.createdAt })
    .from(videos)
    .where(inArray(videos.id, shelf.videos.map((v) => v.id)));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return shelf.videos.flatMap((v) => byId.get(v.id) ?? []);
}

export function dedupe<T extends { id: string }>(lists: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  return lists.flat().filter((v) => !seen.has(v.id) && !!seen.add(v.id));
}

/** The ordered candidates of `sort` for this viewer (signed out: `viewer` null). */
export async function rankedPool(sort: typeof FeedSort.ForYou | typeof FeedSort.Trending, viewer: ExploreViewer | null, scope: SQL, settings: FeedRankSettings, now: Date): Promise<FeedCandidate[]> {
  const pools = (holder.__orochiaFeedPools ??= new Map());
  const key = `${sort}:${sort === FeedSort.ForYou ? (viewer?.id ?? "anon") : "all"}`;
  const hit = pools.get(key);
  if (hit && isAfter(hit.until, now)) return hit.pool;

  const [latest, hot] = await Promise.all([fresh(scope, settings.poolSize), trending(scope, settings, now)]);
  let ordered: FeedCandidate[];
  if (sort === FeedSort.Trending) {
    ordered = dedupe([hot, latest]);
  } else {
    const blended = blendFresh(hot, latest, settings.trendingShare);
    const personal = viewer ? recencyRerank(await recommended(viewer, now).catch(() => []), now, { halfLifeHours: settings.forYouHalfLifeHours, floor: settings.forYouRecencyFloor }) : [];
    ordered = dedupe([personal, blended]);
  }
  const pool = limitConsecutive(ordered, settings.maxConsecutivePerCreator).slice(0, settings.poolSize);

  if (pools.size >= MAX_ENTRIES) for (const [k, v] of pools) if (!isAfter(v.until, now)) pools.delete(k);
  if (pools.size >= MAX_ENTRIES) pools.clear();
  pools.set(key, { pool, until: addSeconds(now, settings.poolCacheSeconds) });
  return pool;
}
