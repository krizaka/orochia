/**
 * Explore's ranking — pure functions, so the order of a section is tested without a database.
 *
 * Trending is engagement over the last {@link TRENDING_WINDOW_DAYS} days, each event weighted by kind (a tip says more
 * than a like, a like more than a view) and decayed by its age (half of its weight every
 * {@link TRENDING_HALF_LIFE_HOURS} hours), so a burst today beats the same burst five days ago. No creator holds more
 * than {@link TRENDING_PER_CREATOR} places. Phase 2 (#54) adds completion, unlocks, bids and personal signals.
 */

export const TRENDING_WINDOW_DAYS = 7;
export const TRENDING_HALF_LIFE_HOURS = 36;
export const TRENDING_PER_CREATOR = 2;
export const ENGAGEMENT_WEIGHTS = { view: 1, like: 4, tip: 12 } as const;

export type EngagementKind = keyof typeof ENGAGEMENT_WEIGHTS;

/** A count of one kind of event on one item, at one moment (views are counted per day, likes and tips per hour). */
export interface EngagementBucket {
  itemId: string;
  kind: EngagementKind;
  at: Date;
  count: number;
}

const HOUR = 3600 * 1000;

/** The share of its weight an event keeps after `ageHours` (1 now, ½ after one half-life; never above 1). */
export function decay(ageHours: number, halfLifeHours = TRENDING_HALF_LIFE_HOURS): number {
  return 0.5 ** (Math.max(0, ageHours) / halfLifeHours);
}

/** Each item's trending score: Σ weight(kind) × count × decay(age). Events outside the window count for nothing. */
export function trendingScores(buckets: readonly EngagementBucket[], now: Date): Map<string, number> {
  const scores = new Map<string, number>();
  const windowHours = TRENDING_WINDOW_DAYS * 24;
  for (const b of buckets) {
    const ageHours = (now.getTime() - b.at.getTime()) / HOUR;
    if (ageHours > windowHours || b.count <= 0) continue;
    const score = ENGAGEMENT_WEIGHTS[b.kind] * b.count * decay(ageHours);
    scores.set(b.itemId, (scores.get(b.itemId) ?? 0) + score);
  }
  return scores;
}

export interface RankCandidate {
  id: string;
  creatorId: string;
  createdAt: Date;
}

/**
 * The trending order: score first, then the newest; items without engagement in the window are left out (the
 * "New" section shows them), and no creator takes more than `perCreator` places.
 */
export function rankTrending<T extends RankCandidate>(
  candidates: readonly T[],
  buckets: readonly EngagementBucket[],
  now: Date,
  { limit = 8, perCreator = TRENDING_PER_CREATOR }: { limit?: number; perCreator?: number } = {},
): (T & { score: number })[] {
  const scores = trendingScores(buckets, now);
  const scored = candidates
    .map((c) => ({ ...c, score: scores.get(c.id) ?? 0 }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime() || a.id.localeCompare(b.id));
  return diversify(scored, limit, perCreator);
}

/** Keeps the order but caps how many places one creator takes. */
export function diversify<T extends { creatorId: string }>(items: readonly T[], limit: number, perCreator: number): T[] {
  const taken = new Map<string, number>();
  const out: T[] = [];
  for (const item of items) {
    const n = taken.get(item.creatorId) ?? 0;
    if (n >= perCreator) continue;
    taken.set(item.creatorId, n + 1);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/** A live story's score: its own views, likes and tips, decayed from when it was posted (stories live 24 hours). */
export function storyScore(story: { viewsCount: number; likesCount: number; tipsCount: number; createdAt: Date }, now: Date): number {
  const engagement =
    ENGAGEMENT_WEIGHTS.view * story.viewsCount + ENGAGEMENT_WEIGHTS.like * story.likesCount + ENGAGEMENT_WEIGHTS.tip * story.tipsCount;
  // A new story with no engagement yet still gets a place: freshness alone is worth one view.
  return (1 + engagement) * decay((now.getTime() - story.createdAt.getTime()) / HOUR, 12);
}

/** Live stories, best first (engagement and freshness), at most `perCreator` per creator. */
export function rankStories<T extends { creatorId: string; viewsCount: number; likesCount: number; tipsCount: number; createdAt: Date }>(
  stories: readonly T[],
  now: Date,
  { limit = 12, perCreator = 3 }: { limit?: number; perCreator?: number } = {},
): T[] {
  const sorted = [...stories].sort((a, b) => storyScore(b, now) - storyScore(a, now) || b.createdAt.getTime() - a.createdAt.getTime());
  return diversify(sorted, limit, perCreator);
}

export interface CreatorSignals {
  id: string;
  /** Approved followers. */
  followers: number;
  /** The trending score of their public videos and stories this week. */
  weeklyScore: number;
  /** Their latest public video or story. */
  lastPostAt: Date | null;
}

/** "Creators to follow": what people do with their work this week, their audience, and whether they post lately. */
export function creatorScore(c: CreatorSignals, now: Date): number {
  const recency = c.lastPostAt ? 10 * decay((now.getTime() - c.lastPostAt.getTime()) / HOUR, 72) : 0;
  return c.weeklyScore + 2 * Math.log2(1 + Math.max(0, c.followers)) + recency;
}

export function rankCreators<T extends CreatorSignals>(creators: readonly T[], now: Date, limit = 8): T[] {
  return [...creators]
    .sort((a, b) => creatorScore(b, now) - creatorScore(a, now) || a.id.localeCompare(b.id))
    .slice(0, limit);
}
