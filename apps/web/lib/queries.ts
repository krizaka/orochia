import { db, users, profiles, videos, videoAccessGrants, tipsLedger, payoutRequests } from "@orochia/db";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getCreatorAvailableBalanceCents } from "@orochia/payments";
import type { SessionUser } from "./auth";

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
  visibility: "PUBLIC" | "CONTACTS_ONLY" | "APPROVED_FOLLOWERS_ONLY" | "TIPPED_UNLOCKED";
  minTipAmountCents: number;
  viewsCount: number;
  tipsCount: number;
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
};

/** Ready videos, newest first. Locked videos are listed — their stream is what is protected. */
export async function listFeed(limit = 12): Promise<VideoSummary[]> {
  return db
    .select(videoSummaryColumns)
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(profiles, eq(profiles.userId, videos.creatorId))
    .where(eq(videos.status, "READY"))
    .orderBy(desc(videos.createdAt))
    .limit(limit);
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
}

async function creatorCardFor(userId: string): Promise<CreatorCard | null> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      bio: profiles.bio,
      avatarUrl: profiles.avatarUrl,
      bannerUrl: profiles.bannerUrl,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(users.id, userId), eq(users.role, "CREATOR")))
    .limit(1);
  if (!row) return null;

  const [stats] = await db
    .select({
      totalViews: sql<string>`coalesce(sum(${videos.viewsCount}), 0)`,
      videosCount: sql<string>`count(*)`,
    })
    .from(videos)
    .where(and(eq(videos.creatorId, userId), eq(videos.status, "READY")));
  const [patrons] = await db
    .select({ count: sql<string>`count(distinct ${tipsLedger.senderId})` })
    .from(tipsLedger)
    .where(and(eq(tipsLedger.creatorId, userId), eq(tipsLedger.entryType, "CREATOR_CREDIT")));

  return {
    ...row,
    totalViews: Number(stats?.totalViews ?? 0),
    videosCount: Number(stats?.videosCount ?? 0),
    patrons: Number(patrons?.count ?? 0),
  };
}

/** The creator with the most net earnings, for the home spotlight; null on an empty platform. */
export async function featuredCreator(): Promise<CreatorCard | null> {
  const [top] = await db
    .select({ userId: profiles.userId })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(eq(users.role, "CREATOR"))
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
    .where(and(eq(videos.creatorId, creatorId), eq(videos.status, "READY")))
    .orderBy(desc(videos.createdAt))
    .limit(limit);
}

export interface VideoDetails extends VideoSummary {
  description: string | null;
  creatorId: string;
  creatorBio: string | null;
  createdAt: Date;
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
    })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(profiles, eq(profiles.userId, videos.creatorId))
    .where(eq(videos.id, videoId))
    .limit(1);
  if (!row) return null;
  const more = (await creatorVideos(row.creatorId, 5)).filter((v) => v.id !== videoId).slice(0, 4);
  return { ...row, moreFromCreator: more };
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

export interface Dashboard {
  library: LibraryEntry[];
  ledger: LedgerLine[];
  uploads: VideoSummary[];
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

  const uploads = user.role === "CREATOR" ? await creatorVideos(user.id, 50) : [];

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

  return { library, ledger, uploads, pendingPayoutCents: Number(pending?.total ?? 0) };
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
