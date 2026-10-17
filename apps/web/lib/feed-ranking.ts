import { differenceInMilliseconds } from "date-fns";

import { decay, ENGAGEMENT_WEIGHTS, type EngagementBucket } from "./ranking";

/**
 * How the home feed is ordered — pure, so each rule is a unit test. The parameters are the `feed` domain of
 * `app_settings` (lib/feed-settings.ts); {@link FEED_RANK_DEFAULTS} only says what an unpublished domain means.
 *
 * - **Trending** is engagement velocity: weighted events of the last `velocityWindowHours`, each decayed with a short
 *   half-life, so a burst today beats a bigger pile last week.
 * - **For you, signed out** is a blend of trending and fresh — never pure chronology.
 * - **For you, signed in** is Orazaka's order (ADR-078) re-weighted by recency.
 * - **Diversity** on every list but Latest: no more than `maxConsecutivePerCreator` in a row from one creator.
 * - Nobody is boosted: an official brand account is ranked, and interleaved, like any creator.
 */
export interface FeedRankSettings {
  /** The most items in a row from one creator (every list except Latest). */
  maxConsecutivePerCreator: number;
  /** Of every blended page, the share that comes from Trending (the rest is fresh). */
  trendingShare: number;
  velocityWindowHours: number;
  velocityHalfLifeHours: number;
  /** For you (signed in): how fast an item loses its recency weight, and the least it keeps. */
  forYouHalfLifeHours: number;
  forYouRecencyFloor: number;
  /** How many ranked candidates a feed holds (its pages are slices of it). */
  poolSize: number;
  /** How long a ranked pool is reused, so pages of one scroll agree. */
  poolCacheSeconds: number;
  /** A vertical clip up to this long is a Short (the docs session's `shorts_max_seconds`, when it lands). */
  shortsMaxSeconds: number;
  /** A slide left after less than this share watched is a skip (the recommender's negative signal)… */
  skipBelowPct: number;
  /** …unless it was in view for less than this: a flick past a slide says nothing. */
  minDwellMs: number;
}

// @fixed: defaults of an unpublished `feed` settings domain — an operator publishes a version to change them
export const FEED_RANK_DEFAULTS: FeedRankSettings = {
  maxConsecutivePerCreator: 2,
  trendingShare: 0.5,
  velocityWindowHours: 48,
  velocityHalfLifeHours: 12,
  forYouHalfLifeHours: 72,
  forYouRecencyFloor: 0.2,
  poolSize: 200,
  poolCacheSeconds: 60,
  shortsMaxSeconds: 180,
  skipBelowPct: 25,
  minDwellMs: 800,
};

export interface FeedCandidate {
  id: string;
  creatorId: string;
  createdAt: Date;
}

/**
 * The same order, except that no creator fills more than `max` consecutive places: when a creator has had `max` in a row,
 * the next other creator's item moves up. Nothing is dropped — when only one creator is left, its run is unavoidable.
 */
export function limitConsecutive<T extends { creatorId: string }>(items: readonly T[], max: number): T[] {
  const limit = Math.max(1, Math.trunc(max));
  const rest = [...items];
  const out: T[] = [];
  let run = 0;
  while (rest.length > 0) {
    const last = out[out.length - 1];
    const blocked = (c: T) => last !== undefined && c.creatorId === last.creatorId && run >= limit;
    const at = rest.findIndex((c) => !blocked(c));
    const [next] = rest.splice(at === -1 ? 0 : at, 1);
    run = last && last.creatorId === next.creatorId ? run + 1 : 1;
    out.push(next);
  }
  return out;
}

/** Trending and fresh interleaved by `share` (0 = fresh only first, 1 = trending first), each video once. */
export function blendFresh<T extends { id: string }>(trending: readonly T[], fresh: readonly T[], share: number): T[] {
  const wanted = Math.min(1, Math.max(0, share));
  const seen = new Set<string>();
  const queues: [T[], T[]] = [[...trending], [...fresh]];
  const take = (from: T[]): T | undefined => {
    while (from.length > 0) {
      const next = from.shift()!;
      if (!seen.has(next.id)) {
        seen.add(next.id);
        return next;
      }
    }
    return undefined;
  };
  const out: T[] = [];
  for (let i = 0; ; i++) {
    const preferTrending = Math.ceil((i + 1) * wanted - 1e-9) > Math.ceil(i * wanted - 1e-9);
    const order = preferTrending ? [queues[0], queues[1]] : [queues[1], queues[0]];
    const next = take(order[0]) ?? take(order[1]);
    if (!next) return out;
    out.push(next);
  }
}

/** Orazaka's order (best first) re-weighted by age: rank score × (floor + (1 − floor) × decay). */
export function recencyRerank<T extends { createdAt: Date }>(
  ranked: readonly T[],
  now: Date,
  { halfLifeHours, floor }: { halfLifeHours: number; floor: number },
): T[] {
  const n = ranked.length;
  return ranked
    .map((item, index) => {
      const ageHours = differenceInMilliseconds(now, item.createdAt) / 3_600_000;
      return { item, index, score: ((n - index) / n) * (floor + (1 - floor) * decay(ageHours, halfLifeHours)) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item);
}

/** Engagement velocity: Σ weight × count × decay(age), over the window only. */
export function velocityScores(
  buckets: readonly EngagementBucket[],
  now: Date,
  { velocityWindowHours, velocityHalfLifeHours }: Pick<FeedRankSettings, "velocityWindowHours" | "velocityHalfLifeHours">,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const b of buckets) {
    const ageHours = differenceInMilliseconds(now, b.at) / 3_600_000;
    if (ageHours > velocityWindowHours || b.count <= 0) continue;
    scores.set(b.itemId, (scores.get(b.itemId) ?? 0) + ENGAGEMENT_WEIGHTS[b.kind] * b.count * decay(ageHours, velocityHalfLifeHours));
  }
  return scores;
}

/** Trending order from velocity: best score first, then the newest; items with no velocity are not trending. */
export function rankByVelocity<T extends FeedCandidate>(candidates: readonly T[], scores: ReadonlyMap<string, number>): T[] {
  return candidates
    .filter((c) => (scores.get(c.id) ?? 0) > 0)
    .sort((a, b) => scores.get(b.id)! - scores.get(a.id)! || differenceInMilliseconds(b.createdAt, a.createdAt) || a.id.localeCompare(b.id));
}

/** What leaving a slide tells the recommender: a skip, a view (with its watched share), or nothing. */
export function classifyWatch({ watchedPct, dwellMs }: { watchedPct: number; dwellMs: number }, { skipBelowPct, minDwellMs }: Pick<FeedRankSettings, "skipBelowPct" | "minDwellMs">): "SKIP" | "VIEW" | null {
  if (dwellMs < minDwellMs) return null;
  return watchedPct < skipBelowPct ? "SKIP" : "VIEW";
}
