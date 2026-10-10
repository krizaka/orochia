import {
  complianceReports,
  contentRatings,
  db,
  follows,
  profiles,
  stories,
  users,
  videos,
} from "@orochia/db";
import { signBunnyFileUrl } from "@orochia/media";
import { and, desc, eq, gt, inArray, isNull, ne, notExists, or, type SQL,sql } from "drizzle-orm";

import { type AuctionCardView,listAuctions } from "./auctions";
import { type ChallengeCardView,listChallenges } from "./challenges";
import {
  DISCOVERABLE_VISIBILITY,
  HOLDING_REPORT_REASONS,
  isVeiled,
  UNRESOLVED_REPORT_STATUSES,
} from "./discoverable";
import { bunnyStreamConfig } from "./env";
import { signMediaUrl } from "./media-urls";
import { type EngagementBucket, type EngagementKind,rankCreators, rankStories, rankTrending, TRENDING_WINDOW_DAYS, trendingScores } from "./ranking";
import { matches, rank, startsWith } from "./search";
import { normalizeTag, TAG_SYNONYMS } from "./tags";
import type { VideoVisibility } from "./visibility";

/**
 * Explore's read model: the discovery sections (trending, new, stories, creators to follow, open auctions, open
 * challenges), the search over videos, creators and stories, and the tags. Everything goes through the discovery rules
 * of lib/discoverable.ts (public only, moderation, 18+ veil) — written here once as SQL.
 */

export interface ExploreViewer {
  id: string;
  role: string;
  /** The server checked this account's age (date of birth, 18+) — lifts the veil on adult ratings (lib/discoverable.ts). */
  isAgeVerified?: boolean;
}

const ageChecked = (viewer: ExploreViewer | null) => viewer?.isAgeVerified === true;

// ── The discovery rules, as SQL ───────────────────────────────────────────────────────────────

/** Not held for an unresolved report of a suspected minor or of non-consensual content. */
function notHeld(column: typeof complianceReports.videoId | typeof complianceReports.storyId, id: typeof videos.id | typeof stories.id): SQL {
  return notExists(
    db
      .select({ one: sql`1` })
      .from(complianceReports)
      .where(
        and(
          eq(column, id),
          inArray(complianceReports.status, [...UNRESOLVED_REPORT_STATUSES]),
          inArray(complianceReports.reason, [...HOLDING_REPORT_REASONS]),
        ),
      ),
  );
}

/** A video everyone may find (joined with its creator as `users`). */
export function discoverableVideo(): SQL {
  return and(
    eq(videos.visibility, DISCOVERABLE_VISIBILITY),
    eq(videos.status, "READY"),
    isNull(videos.removedAt),
    isNull(users.suspendedAt),
    notHeld(complianceReports.videoId, videos.id),
  ) as SQL;
}

/** A live story everyone may see (joined with its creator as `users`). */
export function discoverableStory(): SQL {
  return and(
    eq(stories.visibility, DISCOVERABLE_VISIBILITY),
    eq(stories.status, "READY"),
    gt(stories.expiresAt, sql`now()`),
    isNull(stories.removedAt),
    isNull(users.suspendedAt),
    notHeld(complianceReports.storyId, stories.id),
  ) as SQL;
}

/** A creator space that may be suggested: active, verified, creator (or the owner). */
function suggestableCreator(): SQL {
  return and(inArray(users.role, ["CREATOR", "ADMIN"]), eq(users.isVerified, true), isNull(users.suspendedAt)) as SQL;
}

/** A tag in the address, normalised (`?tag=BTS` → `behind-the-scenes`); null when unusable. */
export function exploreTag(raw: string | null | undefined): string | null {
  return raw ? normalizeTag(raw.slice(0, 64)) : null;
}

/** Every spelling filed under a tag (itself and its synonyms) — what a caption's #hashtag may say. */
function spellingsOf(tag: string): string[] {
  return [tag, ...Object.entries(TAG_SYNONYMS).filter(([, to]) => to === tag).map(([from]) => from)];
}

/** A caption or a bio that carries the tag as a #hashtag (any of its spellings, accents ignored). */
function hasHashtag(column: typeof stories.caption | typeof profiles.bio, tag: string): SQL {
  // Spellings are slugs ([a-z0-9-]): nothing in them is special in a regular expression.
  const pattern = `(^|[^a-z0-9-])#(${spellingsOf(tag).join("|")})($|[^a-z0-9-])`;
  return sql`orochia_unaccent(${column}) ~ ${pattern}`;
}

// ── Videos ────────────────────────────────────────────────────────────────────────────────────

export interface ExploreVideo {
  id: string;
  title: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string | null;
  thumbnailUrl: string | null;
  previewAnimationUrl: string | null;
  durationSeconds: number;
  visibility: VideoVisibility;
  minTipAmountCents: number;
  viewsCount: number;
  tipsCount: number;
  likesCount: number;
  commentsCount: number;
  tags: string[];
  /** The 18+ veil (lib/discoverable.ts `isVeiled`): blurred until the viewer reveals it. */
  isBlurred: boolean;
  createdAt: string;
}

const videoColumns = {
  id: videos.id,
  title: videos.title,
  creatorId: videos.creatorId,
  creatorName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
  creatorUsername: users.username,
  creatorAvatar: profiles.avatarUrl,
  thumbnailUrl: videos.thumbnailUrl,
  previewAnimationUrl: videos.previewAnimationUrl,
  durationSeconds: videos.durationSeconds,
  visibility: videos.visibility,
  minTipAmountCents: videos.minTipAmountCents,
  viewsCount: videos.viewsCount,
  tipsCount: videos.tipsCount,
  likesCount: videos.likesCount,
  commentsCount: videos.commentsCount,
  tags: videos.tags,
  isBlurred: videos.isBlurred,
  ratingRequiresBlur: sql<boolean>`coalesce(${contentRatings.requiresBlur}, false)`,
  ratingIsAdult: sql<boolean>`coalesce(${contentRatings.isAdult}, false)`,
  createdAt: videos.createdAt,
};

type VideoRow = { [K in keyof typeof videoColumns]: unknown } & {
  id: string;
  creatorId: string;
  tags: string[] | null;
  isBlurred: boolean;
  ratingRequiresBlur: boolean;
  ratingIsAdult: boolean;
  createdAt: Date;
  thumbnailUrl: string | null;
  previewAnimationUrl: string | null;
  creatorAvatar: string | null;
};

function videoQuery() {
  return db
    .select(videoColumns)
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(profiles, eq(profiles.userId, videos.creatorId))
    .leftJoin(contentRatings, eq(contentRatings.id, videos.contentRatingId));
}

function toExploreVideo(row: VideoRow, viewer: ExploreViewer | null): ExploreVideo {
  const r = row as unknown as Omit<ExploreVideo, "isBlurred" | "createdAt" | "tags"> & VideoRow;
  return {
    id: r.id,
    title: r.title,
    creatorName: r.creatorName,
    creatorUsername: r.creatorUsername,
    creatorAvatar: signMediaUrl(r.creatorAvatar),
    thumbnailUrl: signMediaUrl(r.thumbnailUrl),
    previewAnimationUrl: signMediaUrl(r.previewAnimationUrl),
    durationSeconds: r.durationSeconds,
    visibility: r.visibility,
    minTipAmountCents: r.minTipAmountCents,
    viewsCount: r.viewsCount,
    tipsCount: r.tipsCount,
    likesCount: r.likesCount,
    commentsCount: r.commentsCount,
    tags: r.tags ?? [],
    isBlurred: isVeiled({ isBlurred: r.isBlurred, ratingRequiresBlur: r.ratingRequiresBlur, ratingIsAdult: r.ratingIsAdult }, ageChecked(viewer)),
    createdAt: r.createdAt.toISOString(),
  };
}

/** The newest discoverable videos. */
export async function newVideos(viewer: ExploreViewer | null, limit = 8, offset = 0): Promise<ExploreVideo[]> {
  const rows = await videoQuery().where(discoverableVideo()).orderBy(desc(videos.createdAt), desc(videos.id)).limit(limit).offset(offset);
  return rows.map((r) => toExploreVideo(r as VideoRow, viewer));
}

/** Engagement on discoverable videos within the trending window, counted per day (views) and per hour (likes, tips). */
async function videoEngagement(): Promise<(EngagementBucket & { creatorId: string; createdAt: Date })[]> {
  const days = TRENDING_WINDOW_DAYS;
  const rows = await db.execute<{ item_id: string; kind: EngagementKind; at: Date | string; count: number; creator_id: string; created_at: Date | string }>(sql`
    select e.item_id, e.kind, e.at, e.count, ${videos.creatorId} as creator_id, ${videos.createdAt} as created_at
    from (
      select video_id as item_id, 'view' as kind, (viewed_on + interval '12 hours') at time zone 'UTC' as at, count(*)::int as count
        from video_views where viewed_on >= (now() - make_interval(days => ${days}))::date group by video_id, viewed_on
      union all
      select video_id, 'like', date_trunc('hour', created_at), count(*)::int
        from video_likes where created_at > now() - make_interval(days => ${days}) group by video_id, date_trunc('hour', created_at)
      union all
      select video_id, 'tip', date_trunc('hour', created_at), count(*)::int
        from tips_ledger where entry_type = 'CREATOR_CREDIT' and video_id is not null and created_at > now() - make_interval(days => ${days})
        group by video_id, date_trunc('hour', created_at)
    ) e
    join ${videos} on ${videos.id} = e.item_id
    join ${users} on ${users.id} = ${videos.creatorId}
    where ${discoverableVideo()}
    limit 20000`);
  return rows.rows.map((r) => ({
    itemId: r.item_id,
    kind: r.kind,
    at: new Date(r.at),
    count: Number(r.count),
    creatorId: r.creator_id,
    createdAt: new Date(r.created_at),
  }));
}

/** The videos in the given order (ids from a ranking). */
async function videosByIds(ids: string[], viewer: ExploreViewer | null): Promise<ExploreVideo[]> {
  if (ids.length === 0) return [];
  const rows = await videoQuery().where(and(discoverableVideo(), inArray(videos.id, ids)));
  const byId = new Map(rows.map((r) => [r.id, toExploreVideo(r as VideoRow, viewer)]));
  return ids.map((id) => byId.get(id)).filter((v): v is ExploreVideo => Boolean(v));
}

/** "Trending this week": views, likes and tips, time-decayed, two places per creator at most (lib/ranking.ts). */
export async function trendingVideos(viewer: ExploreViewer | null, limit = 8, now = new Date()): Promise<ExploreVideo[]> {
  const buckets = await videoEngagement();
  const candidates = new Map<string, { id: string; creatorId: string; createdAt: Date }>();
  for (const b of buckets) candidates.set(b.itemId, { id: b.itemId, creatorId: b.creatorId, createdAt: b.createdAt });
  const ranked = rankTrending([...candidates.values()], buckets, now, { limit });
  return videosByIds(ranked.map((r) => r.id), viewer);
}

// ── Stories ───────────────────────────────────────────────────────────────────────────────────

export interface ExploreStory {
  id: string;
  type: "image" | "video";
  creatorUsername: string;
  creatorName: string;
  creatorAvatar: string | null;
  /** A still picture only — playing a story goes through the story viewer on the creator's profile. */
  posterUrl: string | null;
  caption: string;
  isBlurred: boolean;
  viewsCount: number;
  likesCount: number;
  createdAt: string;
  expiresAt: string;
  /** Hours left before it expires, rounded up (at least 1). */
  hoursLeft: number;
}

/** A story's still: the stored thumbnail of an image story, Bunny's signed thumbnail of a video story. */
function storyPoster(s: { mediaType: string; bunnyVideoId: string | null; thumbnailUrl: string | null; mediaUrl: string | null }): string | null {
  if (s.mediaType === "VIDEO" && s.bunnyVideoId) {
    try {
      const config = bunnyStreamConfig();
      return signBunnyFileUrl({ hostname: config.hostname, path: `/${s.bunnyVideoId}/thumbnail.jpg`, tokenAuthKey: config.tokenAuthKey });
    } catch {
      return null;
    }
  }
  return signMediaUrl(s.thumbnailUrl ?? s.mediaUrl);
}

async function storyRows(where: SQL | undefined, limit: number) {
  return db
    .select({
      id: stories.id,
      creatorId: stories.creatorId,
      mediaType: stories.mediaType,
      bunnyVideoId: stories.bunnyVideoId,
      mediaUrl: stories.mediaUrl,
      thumbnailUrl: stories.thumbnailUrl,
      caption: stories.caption,
      isBlurred: stories.isBlurred,
      ratingRequiresBlur: sql<boolean>`coalesce(${contentRatings.requiresBlur}, false)`,
      ratingIsAdult: sql<boolean>`coalesce(${contentRatings.isAdult}, false)`,
      viewsCount: stories.viewsCount,
      likesCount: stories.likesCount,
      tipsCount: stories.tipsCount,
      createdAt: stories.createdAt,
      expiresAt: stories.expiresAt,
      creatorUsername: users.username,
      creatorName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      creatorAvatar: profiles.avatarUrl,
    })
    .from(stories)
    .innerJoin(users, eq(users.id, stories.creatorId))
    .leftJoin(profiles, eq(profiles.userId, stories.creatorId))
    .leftJoin(contentRatings, eq(contentRatings.id, stories.contentRatingId))
    .where(and(discoverableStory(), where))
    .orderBy(desc(stories.createdAt))
    .limit(limit);
}

function toExploreStory(r: Awaited<ReturnType<typeof storyRows>>[number], viewer: ExploreViewer | null): ExploreStory {
  return {
    id: r.id,
    type: r.mediaType === "VIDEO" ? "video" : "image",
    creatorUsername: r.creatorUsername,
    creatorName: r.creatorName,
    creatorAvatar: signMediaUrl(r.creatorAvatar),
    posterUrl: storyPoster(r),
    caption: r.caption ?? "",
    isBlurred: isVeiled({ isBlurred: r.isBlurred, ratingRequiresBlur: r.ratingRequiresBlur, ratingIsAdult: r.ratingIsAdult }, ageChecked(viewer)),
    viewsCount: r.viewsCount,
    likesCount: r.likesCount,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    hoursLeft: Math.max(1, Math.ceil((r.expiresAt.getTime() - Date.now()) / 3_600_000)),
  };
}

/** Public live stories, best first (engagement and freshness, three per creator at most). */
export async function liveStories(viewer: ExploreViewer | null, limit = 12, now = new Date()): Promise<ExploreStory[]> {
  const rows = await storyRows(undefined, 300);
  return rankStories(rows, now, { limit }).map((r) => toExploreStory(r, viewer));
}

// ── Creators ──────────────────────────────────────────────────────────────────────────────────

export interface ExploreCreator {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  isVerified: boolean;
  followers: number;
  /** Discoverable videos and live stories. */
  publicItems: number;
}

/**
 * Creator spaces with discoverable work, with the signals "Creators to follow" ranks on. `match` narrows them (a
 * search, a tag); the viewer and the creators they already follow (or asked to) are left out.
 */
async function creatorCandidates(viewer: ExploreViewer | null, match: SQL | undefined, limit: number) {
  const items = sql`(
    select ${videos.creatorId} as creator_id, ${videos.createdAt} as at from ${videos}
      join ${users} on ${users.id} = ${videos.creatorId} where ${discoverableVideo()}
    union all
    select ${stories.creatorId}, ${stories.createdAt} from ${stories}
      join ${users} on ${users.id} = ${stories.creatorId} where ${discoverableStory()}
  )`;
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      avatarUrl: profiles.avatarUrl,
      bannerUrl: profiles.bannerUrl,
      bio: profiles.bio,
      isVerified: users.isVerified,
      followers: sql<number>`(select count(*)::int from ${follows} f where f.creator_id = ${users.id} and f.status = 'APPROVED')`,
      publicItems: sql<number>`(select count(*)::int from ${items} i where i.creator_id = ${users.id})`,
      lastPostAt: sql<Date | string | null>`(select max(i.at) from ${items} i where i.creator_id = ${users.id})`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        suggestableCreator(),
        sql`exists (select 1 from ${items} i where i.creator_id = ${users.id})`,
        viewer ? ne(users.id, viewer.id) : undefined,
        viewer ? sql`not exists (select 1 from ${follows} f where f.follower_id = ${viewer.id} and f.creator_id = ${users.id})` : undefined,
        match,
      ),
    )
    .limit(limit);
  return rows.map((r) => ({ ...r, followers: Number(r.followers), publicItems: Number(r.publicItems), lastPostAt: r.lastPostAt ? new Date(r.lastPostAt) : null }));
}

function toExploreCreator(r: Awaited<ReturnType<typeof creatorCandidates>>[number]): ExploreCreator {
  return {
    id: r.id,
    username: r.username,
    displayName: r.displayName,
    avatarUrl: signMediaUrl(r.avatarUrl),
    bannerUrl: signMediaUrl(r.bannerUrl),
    bio: r.bio,
    isVerified: r.isVerified,
    followers: r.followers,
    publicItems: r.publicItems,
  };
}

/** "Creators to follow": this week's engagement on their public work, their audience, how lately they posted. */
export async function creatorsToFollow(viewer: ExploreViewer | null, limit = 8, now = new Date()): Promise<ExploreCreator[]> {
  const [candidates, buckets, storyList] = await Promise.all([creatorCandidates(viewer, undefined, 200), videoEngagement(), storyRows(undefined, 300)]);
  const videoScores = trendingScores(buckets, now);
  const weekly = new Map<string, number>();
  const creatorOf = new Map(buckets.map((b) => [b.itemId, b.creatorId]));
  for (const [videoId, score] of videoScores) {
    const creatorId = creatorOf.get(videoId);
    if (creatorId) weekly.set(creatorId, (weekly.get(creatorId) ?? 0) + score);
  }
  for (const s of storyList) {
    const engagement = s.viewsCount + 4 * s.likesCount + 12 * s.tipsCount;
    weekly.set(s.creatorId, (weekly.get(s.creatorId) ?? 0) + engagement);
  }
  const ranked = rankCreators(
    candidates.map((c) => ({ ...c, weeklyScore: weekly.get(c.id) ?? 0 })),
    now,
    limit,
  );
  return ranked.map(toExploreCreator);
}

// ── Tags ──────────────────────────────────────────────────────────────────────────────────────

/** The most used tags of discoverable videos. */
export async function discoverableTags(limit = 16): Promise<{ tag: string; count: number }[]> {
  const rows = await db.execute<{ tag: string; count: number }>(sql`
    select t.tag, count(*)::int as count
    from ${videos}
    join ${users} on ${users.id} = ${videos.creatorId}
    cross join lateral unnest(${videos.tags}) as t(tag)
    where ${discoverableVideo()}
    group by t.tag order by count(*) desc, t.tag limit ${limit}`);
  return rows.rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/** The tags a creator used on their videos (any state but deleted), most used first — the upload suggestions. */
export async function creatorTagHistory(creatorId: string, limit = 30): Promise<{ tag: string; count: number }[]> {
  const rows = await db.execute<{ tag: string; count: number }>(sql`
    select t.tag, count(*)::int as count
    from ${videos} cross join lateral unnest(${videos.tags}) as t(tag)
    where ${videos.creatorId} = ${creatorId} and ${videos.removedAt} is null
    group by t.tag order by count(*) desc, t.tag limit ${limit}`);
  return rows.rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

// ── Sections and results ──────────────────────────────────────────────────────────────────────

export interface ExploreSections {
  trending: ExploreVideo[];
  fresh: ExploreVideo[];
  stories: ExploreStory[];
  creators: ExploreCreator[];
  auctions: AuctionCardView[];
  challenges: ChallengeCardView[];
  tags: { tag: string; count: number }[];
}

/** Everything the explore page shows before a search: six sections, each possibly empty (the page designs that). */
export async function exploreSections(viewer: ExploreViewer | null): Promise<ExploreSections> {
  const [trending, fresh, storyList, creators, auctions, challenges, tags] = await Promise.all([
    trendingVideos(viewer),
    newVideos(viewer),
    liveStories(viewer),
    creatorsToFollow(viewer),
    listAuctions("open", viewer?.id ?? null, 8),
    listChallenges("open", viewer?.id ?? null, 8),
    discoverableTags(20),
  ]);
  return { trending, fresh, stories: storyList, creators, auctions, challenges, tags };
}

export const RESULTS_PAGE = 24;

export interface ExploreQuery {
  q?: string;
  tag?: string | null;
  page?: number;
}

export interface ExploreResults {
  videos: ExploreVideo[];
  hasMore: boolean;
  creators: ExploreCreator[];
  stories: ExploreStory[];
}

/**
 * A search and/or a tag over videos, creators and stories. Without either, every discoverable video, newest first
 * (the "all videos" view). Videos are paged ({@link RESULTS_PAGE}); creators and stories are the best few.
 */
export async function exploreResults(viewer: ExploreViewer | null, { q, tag, page = 1 }: ExploreQuery): Promise<ExploreResults> {
  const term = q?.trim().slice(0, 100) ?? "";
  const offset = (Math.max(1, page) - 1) * RESULTS_PAGE;

  const videoFilters: SQL[] = [discoverableVideo()];
  const storyFilters: SQL[] = [];
  const creatorFilters: SQL[] = [];
  if (term) {
    videoFilters.push(or(matches(videos.searchVector, term), matches(profiles.searchVector, term), startsWith(users.username, term)) as SQL);
    storyFilters.push(or(matches(stories.searchVector, term), startsWith(users.username, term)) as SQL);
    creatorFilters.push(or(matches(profiles.searchVector, term), startsWith(users.username, term)) as SQL);
  }
  if (tag) {
    videoFilters.push(sql`${videos.tags} @> array[${tag}]::text[]`);
    storyFilters.push(hasHashtag(stories.caption, tag));
    creatorFilters.push(
      or(
        hasHashtag(profiles.bio, tag),
        sql`exists (select 1 from ${videos} tv where tv.creator_id = ${users.id} and tv.tags @> array[${tag}]::text[]
              and tv.visibility = ${DISCOVERABLE_VISIBILITY} and tv.status = 'READY' and tv.removed_at is null)`,
      ) as SQL,
    );
  }

  const videoOrder = term ? [desc(rank(videos.searchVector, term)), desc(videos.createdAt)] : [desc(videos.createdAt), desc(videos.id)];
  const [videoRows, creatorRows, storyList] = await Promise.all([
    videoQuery().where(and(...videoFilters)).orderBy(...videoOrder).limit(RESULTS_PAGE + 1).offset(offset),
    term || tag ? creatorCandidates(null, and(...creatorFilters), 12) : Promise.resolve([]),
    term || tag ? storyRows(and(...storyFilters), 12) : Promise.resolve([]),
  ]);
  const creators = term
    ? [...creatorRows].sort((a, b) => Number(b.username.toLowerCase().startsWith(term.toLowerCase().replace(/^@/, ""))) - Number(a.username.toLowerCase().startsWith(term.toLowerCase().replace(/^@/, ""))) || b.followers - a.followers)
    : [...creatorRows].sort((a, b) => b.followers - a.followers);
  return {
    videos: videoRows.slice(0, RESULTS_PAGE).map((r) => toExploreVideo(r as VideoRow, viewer)),
    hasMore: videoRows.length > RESULTS_PAGE,
    creators: creators.slice(0, 8).map(toExploreCreator),
    stories: storyList.map((s) => toExploreStory(s, viewer)),
  };
}
