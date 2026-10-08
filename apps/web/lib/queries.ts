import { db, users, profiles, videos, videoAccessGrants, tipsLedger, payoutRequests, playlists, stories } from "@orochia/db";
import { and, desc, eq, gt, ilike, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { getCreatorAvailableBalanceCents } from "@orochia/payments";
import type { SessionUser } from "./auth";
import { withSignedMedia } from "./media-urls";

/**
 * Read models of the web app. Every screen reads the database through these functions — there is
 * no showcase data in the pages: an empty platform renders empty states.
 */

export interface VideoSummary {
  id: string;
  title: string;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string | null;
  thumbnailUrl: string | null;
  previewAnimationUrl: string | null;
  durationSeconds: number;
  visibility: "PUBLIC" | "CONTACTS_ONLY" | "APPROVED_FOLLOWERS_ONLY" | "TIPPED_UNLOCKED" | "INVITED_ONLY";
  minTipAmountCents: number;
  viewsCount: number;
  tipsCount: number;
  likesCount: number;
  commentsCount: number;
}

const videoSummaryColumns = {
  id: videos.id,
  title: videos.title,
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
};

/**
 * A video anyone may see listed: encoded, not taken down, from an active account, and not
 * invited-only — those are known only to the people they were shared with.
 */
const listable = () =>
  and(eq(videos.status, "READY"), isNull(videos.removedAt), isNull(users.suspendedAt), ne(videos.visibility, "INVITED_ONLY"));

/** Ready videos, newest first. Locked videos are listed — their stream is what is protected. */
export async function listFeed(limit = 12): Promise<VideoSummary[]> {
  return searchVideos({ limit });
}

export interface VideoSearch {
  q?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}

/** The explore search: title, description, creator or tag; newest first. */
export async function searchVideos({ q, tag, limit = 24, offset = 0 }: VideoSearch): Promise<VideoSummary[]> {
  const filters: (SQL | undefined)[] = [listable()];
  const term = q?.trim();
  if (term) {
    const like = `%${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    filters.push(or(ilike(videos.title, like), ilike(videos.description, like), ilike(users.username, like), ilike(profiles.displayName, like)));
  }
  if (tag?.trim()) filters.push(sql`${tag.trim().toLowerCase()} = any(${videos.tags})`);
  return db
    .select(videoSummaryColumns)
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(profiles, eq(profiles.userId, videos.creatorId))
    .where(and(...filters))
    .orderBy(desc(videos.createdAt))
    .limit(Math.min(Math.max(limit, 1), 60))
    .offset(Math.max(offset, 0))
    .then((rows) => rows.map(withSignedMedia));
}

/** The most used tags of listable videos, for the explore filters. */
export async function popularTags(limit = 16): Promise<{ tag: string; count: number }[]> {
  const rows = await db.execute<{ tag: string; count: string }>(sql`
    select t.tag, count(*)::text as count
    from ${videos} v
    join ${users} u on u.id = v.creator_id
    cross join lateral unnest(v.tags) as t(tag)
    where v.status = 'READY' and v.removed_at is null and u.suspended_at is null and v.visibility <> 'INVITED_ONLY'
    group by t.tag order by count(*) desc, t.tag limit ${limit}`);
  return rows.rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

export interface CreatorCard {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  totalViews: number;
  patrons: number;
  videosCount: number;
  minTipAmountCents: number;
  totalTipsEarnedCents: number;
  isVerified: boolean;
}

async function creatorCardFor(userId: string): Promise<CreatorCard | null> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      isVerified: users.isVerified,
      displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      bio: profiles.bio,
      avatarUrl: profiles.avatarUrl,
      bannerUrl: profiles.bannerUrl,
      minTipAmountCents: profiles.minTipAmountCents,
      totalTipsEarnedCents: profiles.totalTipsEarnedCents,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.id, userId), eq(users.role, "CREATOR"), isNull(users.suspendedAt)))
    .limit(1);
  if (!row) return null;

  const [stats] = await db
    .select({
      totalViews: sql<string>`coalesce(sum(${videos.viewsCount}), 0)`,
      videosCount: sql<string>`count(*)`,
    })
    .from(videos)
    .where(and(eq(videos.creatorId, userId), eq(videos.status, "READY"), isNull(videos.removedAt)));
  const [patrons] = await db
    .select({ count: sql<string>`count(distinct ${tipsLedger.senderId})` })
    .from(tipsLedger)
    .where(and(eq(tipsLedger.creatorId, userId), eq(tipsLedger.entryType, "CREATOR_CREDIT")));

  return {
    ...row,
    totalViews: Number(stats?.totalViews ?? 0),
    videosCount: Number(stats?.videosCount ?? 0),
    patrons: Number(patrons?.count ?? 0),
    minTipAmountCents: Number(row.minTipAmountCents ?? 500),
    totalTipsEarnedCents: Number(row.totalTipsEarnedCents ?? 0),
  };
}

/** Active verified creators from DB with their latest video thumbnail for the stories bar */
export async function featuredCreator(): Promise<CreatorCard | null> {
  const [top] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(and(eq(users.role, "CREATOR"), isNull(users.suspendedAt)))
    .orderBy(desc(profiles.totalTipsEarnedCents))
    .limit(1);
  return top ? creatorCardFor(top.userId) : null;
}

export async function creatorByUsername(username: string): Promise<CreatorCard | null> {
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  return row ? creatorCardFor(row.id) : null;
}

export async function creatorVideos(creatorId: string, limit = 24): Promise<VideoSummary[]> {
  return db
    .select(videoSummaryColumns)
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(profiles, eq(profiles.userId, videos.creatorId))
    .where(and(eq(videos.creatorId, creatorId), listable()))
    .orderBy(desc(videos.createdAt))
    .limit(limit)
    .then((rows) => rows.map(withSignedMedia));
}

export interface VideoDetails extends VideoSummary {
  description: string | null;
  creatorId: string;
  creatorBio: string | null;
  createdAt: Date;
  sharesCount: number;
  commentsEnabled: boolean;
  moreFromCreator: VideoSummary[];
}

/** A video's public metadata (never its stream: that goes through the access resolver). */
export async function videoDetails(videoId: string): Promise<VideoDetails | null> {
  const [row] = await db
    .select({
      ...videoSummaryColumns,
      description: videos.description,
      creatorId: videos.creatorId,
      creatorBio: profiles.bio,
      createdAt: videos.createdAt,
      sharesCount: videos.sharesCount,
      commentsEnabled: videos.commentsEnabled,
    })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(profiles, eq(profiles.userId, videos.creatorId))
    .where(and(eq(videos.id, videoId), isNull(videos.removedAt), isNull(users.suspendedAt)))
    .limit(1);
  if (!row) return null;
  const more = (await creatorVideos(row.creatorId, 5)).filter((v) => v.id !== videoId).slice(0, 4);
  return { ...withSignedMedia(row), moreFromCreator: more };
}

export interface AccountProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: SessionUser["role"];
  avatarUrl: string | null;
  bio: string | null;
  payoutAddressCrypto: string | null;
  balanceCents: number;
  unlockedVideosCount: number;
  isAgeVerified: boolean;
  emailVerified: boolean;
}

/** The signed-in account as the UI shows it; the balance is computed from the ledger. */
export async function accountProfile(user: SessionUser): Promise<AccountProfile | null> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      isAgeVerified: users.isAgeVerified,
      emailVerified: sql<boolean>`${users.emailVerifiedAt} is not null`,
      displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      avatarUrl: profiles.avatarUrl,
      bio: profiles.bio,
      payoutAddressCrypto: profiles.payoutAddressCrypto,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row) return null;

  const [unlocked] = await db
    .select({ count: sql<string>`count(*)` })
    .from(videoAccessGrants)
    .where(eq(videoAccessGrants.userId, user.id));
  const balanceCents = row.role === "CREATOR" ? await getCreatorAvailableBalanceCents(user.id) : 0;

  return { ...row, balanceCents, unlockedVideosCount: Number(unlocked?.count ?? 0) };
}

export interface LibraryEntry {
  id: string;
  title: string;
  creatorName: string;
  durationSeconds: number;
  unlockedAt: Date;
  amountPaidCents: number;
  thumbnailUrl: string | null;
}

export interface LedgerLine {
  id: string;
  createdAt: Date;
  entryType: string;
  counterparty: string;
  amountCents: number;
  gateway: string;
}

/** The reason recorded when a creator deletes their own video (a withdrawal, not a takedown). */
export const CREATOR_DELETED = "Deleted by its creator";

export interface StudioVideo extends VideoSummary {
  description: string | null;
  tags: string[];
  status: "PENDING_UPLOAD" | "PROCESSING" | "READY" | "FAILED";
  removedAt: Date | null;
  removalReason: string | null;
}

/** Every video of a creator, whatever its state (encoding, failed, taken down) — not the ones they deleted. */
export async function studioVideos(creatorId: string, limit = 100): Promise<StudioVideo[]> {
  const rows = await db
    .select({
      ...videoSummaryColumns,
      description: videos.description,
      tags: videos.tags,
      status: videos.status,
      removedAt: videos.removedAt,
      removalReason: videos.removalReason,
    })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(profiles, eq(profiles.userId, videos.creatorId))
    .where(and(eq(videos.creatorId, creatorId), sql`(${videos.removalReason} is distinct from ${CREATOR_DELETED})`))
    .orderBy(desc(videos.createdAt))
    .limit(limit);
  return rows.map((r) => withSignedMedia({ ...r, tags: r.tags ?? [] }));
}

export interface Dashboard {
  library: LibraryEntry[];
  ledger: LedgerLine[];
  uploads: StudioVideo[];
  pendingPayoutCents: number;
}

/** Everything the personal dashboard shows, for the signed-in user only. */
export async function dashboardFor(user: SessionUser): Promise<Dashboard> {
  const library = await db
    .select({
      id: videos.id,
      title: videos.title,
      creatorName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      durationSeconds: videos.durationSeconds,
      unlockedAt: videoAccessGrants.createdAt,
      amountPaidCents: sql<number>`coalesce(${videoAccessGrants.amountPaidCents}, 0)`,
      thumbnailUrl: videos.thumbnailUrl,
    })
    .from(videoAccessGrants)
    .innerJoin(videos, eq(videos.id, videoAccessGrants.videoId))
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(profiles, eq(profiles.userId, videos.creatorId))
    .where(eq(videoAccessGrants.userId, user.id))
    .orderBy(desc(videoAccessGrants.createdAt))
    .limit(50);

  const ledgerColumns = {
    id: tipsLedger.id,
    createdAt: tipsLedger.createdAt,
    entryType: tipsLedger.entryType,
    amountCents: tipsLedger.grossAmountCents,
    gateway: tipsLedger.gateway,
  };
  const ledger: LedgerLine[] =
    user.role === "CREATOR"
      ? (
          await db
            .select({ ...ledgerColumns, amountCents: tipsLedger.netAmountCents, counterparty: sql<string>`coalesce(${users.username}, 'anonymous')` })
            .from(tipsLedger)
            .leftJoin(users, eq(users.id, tipsLedger.senderId))
            .where(eq(tipsLedger.creatorId, user.id))
            .orderBy(desc(tipsLedger.createdAt))
            .limit(50)
        )
      : await db
          .select({ ...ledgerColumns, counterparty: sql<string>`coalesce(${profiles.displayName}, ${users.username})` })
          .from(tipsLedger)
          .innerJoin(users, eq(users.id, tipsLedger.creatorId))
          .leftJoin(profiles, eq(profiles.userId, tipsLedger.creatorId))
          .where(and(eq(tipsLedger.senderId, user.id), eq(tipsLedger.entryType, "CREATOR_CREDIT")))
          .orderBy(desc(tipsLedger.createdAt))
          .limit(50);

  const uploads = user.role === "CREATOR" ? await studioVideos(user.id) : [];

  const [pending] =
    user.role === "CREATOR"
      ? await db
          .select({ total: sql<string>`coalesce(sum(${payoutRequests.amountCents}), 0)` })
          .from(payoutRequests)
          .where(
            and(
              eq(payoutRequests.creatorId, user.id),
              ne(payoutRequests.status, "FAILED"),
              ne(payoutRequests.status, "SETTLED"),
            ),
          )
      : [{ total: "0" }];

  return { library: library.map(withSignedMedia), ledger, uploads, pendingPayoutCents: Number(pending?.total ?? 0) };
}

export interface Treasury {
  grossCents: number;
  platformFeeCents: number;
  creatorNetCents: number;
  creditsCount: number;
  payoutsRequestedCents: number;
  payoutsSettledCents: number;
}

/** Platform-wide money figures, from the ledger only (administrators). */
export async function treasury(): Promise<Treasury> {
  const [credits] = await db
    .select({
      gross: sql<string>`coalesce(sum(${tipsLedger.grossAmountCents}), 0)`,
      fee: sql<string>`coalesce(sum(${tipsLedger.platformFeeCents}), 0)`,
      net: sql<string>`coalesce(sum(${tipsLedger.netAmountCents}), 0)`,
      count: sql<string>`count(*)`,
    })
    .from(tipsLedger)
    .where(eq(tipsLedger.entryType, "CREATOR_CREDIT"));
  const [payouts] = await db
    .select({
      requested: sql<string>`coalesce(sum(${payoutRequests.amountCents}) filter (where ${payoutRequests.status} not in ('FAILED', 'SETTLED')), 0)`,
      settled: sql<string>`coalesce(sum(${payoutRequests.amountCents}) filter (where ${payoutRequests.status} = 'SETTLED'), 0)`,
    })
    .from(payoutRequests);
  return {
    grossCents: Number(credits?.gross ?? 0),
    platformFeeCents: Number(credits?.fee ?? 0),
    creatorNetCents: Number(credits?.net ?? 0),
    creditsCount: Number(credits?.count ?? 0),
    payoutsRequestedCents: Number(payouts?.requested ?? 0),
    payoutsSettledCents: Number(payouts?.settled ?? 0),
  };
}

/** Catalogue figures for administrators, from the database (not invented CDN numbers). */
export async function catalogueStats() {
  const rows = await db
    .select({ status: videos.status, count: sql<string>`count(*)`, views: sql<string>`coalesce(sum(${videos.viewsCount}), 0)` })
    .from(videos)
    .groupBy(videos.status);
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
  return {
    videosByStatus: byStatus,
    totalViews: rows.reduce((sum, r) => sum + Number(r.views), 0),
  };
}

/**
 * What the sitemap lists: listable videos (never invited-only), the creators who publish them, and
 * public collections of active accounts — each with its last change.
 */
export async function sitemapEntries(limit = 20000) {
  const [videoRows, creatorRows, collectionRows] = await Promise.all([
    db
      .select({ id: videos.id, updatedAt: videos.updatedAt })
      .from(videos)
      .innerJoin(users, eq(users.id, videos.creatorId))
      .where(listable())
      .orderBy(desc(videos.updatedAt))
      .limit(limit),
    db
      .select({ username: users.username, updatedAt: sql<Date>`max(${videos.updatedAt})` })
      .from(videos)
      .innerJoin(users, eq(users.id, videos.creatorId))
      .where(listable())
      .groupBy(users.username),
    db
      .select({ id: playlists.id, updatedAt: playlists.updatedAt })
      .from(playlists)
      .innerJoin(users, eq(users.id, playlists.creatorId))
      .where(and(eq(playlists.visibility, "PUBLIC"), isNull(users.suspendedAt)))
      .limit(limit),
  ]);
  return { videos: videoRows, creators: creatorRows, collections: collectionRows };
}

/** Public figures for the home page: listed videos and the creators who publish them. */
export async function platformStats(): Promise<{ videos: number; creators: number }> {
  const [row] = await db
    .select({ videos: sql<number>`count(*)::int`, creators: sql<number>`count(distinct ${videos.creatorId})::int` })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .where(listable());
  return { videos: row?.videos ?? 0, creators: row?.creators ?? 0 };
}
