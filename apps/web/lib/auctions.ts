import { db, auctions, auctionBids, follows, profiles, users, videos, videoAccessGrants } from "@orochia/db";
import { and, asc, desc, eq, gt, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import {
  AuctionError,
  auctionPhase,
  cancelAuction,
  closeAuction,
  liveAuctionIdsFor,
  getWalletBalanceCents,
  minimumNextBidCents,
  suggestedBidsCents,
  type AuctionPhase,
  type AuctionRow,
  type CloseOutcome,
} from "@orochia/payments";
import { HttpError } from "./http";
import { signMediaUrl } from "./media-urls";
import { notify } from "./notifications";
import { publish } from "./realtime";

/**
 * Auctions in the web app: read models, the public live feed and the notifications. The rules and the money are in
 * packages/payments (auction-rules.ts, auctions.ts); routes call this module, never the database directly.
 *
 * Privacy: bidders are shown under a per-auction alias ("Bidder 3", by order of first bid) — a viewer sees "You" for
 * their own bids, and only the creator sees who leads. Nobody's bidding history is public.
 */

export const auctionTopic = (id: string) => `auction:${id}`;

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export interface AuctionBidView {
  id: string;
  amountCents: number;
  alias: number;
  mine: boolean;
  createdAt: string;
}

export interface AuctionView {
  id: string;
  status: AuctionRow["status"];
  phase: AuctionPhase;
  rights: AuctionRow["rights"];
  settlement: AuctionRow["settlement"];
  startingPriceCents: number;
  highestBidCents: number;
  bidsCount: number;
  biddersCount: number;
  minimumNextBidCents: number;
  suggestedBidsCents: number[];
  startsAt: string;
  endsAt: string;
  scheduledEndsAt: string;
  decisionDeadline: string | null;
  serverNow: string;
  video: { id: string; title: string; thumbnailUrl: string | null; durationSeconds: number };
  creator: { username: string; name: string; avatarUrl: string | null };
  leaderAlias: number | null;
  /** The leading bidder's username — for the creator only. */
  leaderUsername: string | null;
  recentBids: AuctionBidView[];
  viewer: {
    signedIn: boolean;
    isCreator: boolean;
    isLeader: boolean;
    alias: number | null;
    won: boolean;
    canDownload: boolean;
    balanceCents: number | null;
  };
}

/** A bidder's alias in an auction: their rank by first bid (1 = the first to bid). */
async function aliases(auctionId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ bidderId: auctionBids.bidderId, first: sql<string>`min(${auctionBids.createdAt})` })
    .from(auctionBids)
    .where(eq(auctionBids.auctionId, auctionId))
    .groupBy(auctionBids.bidderId)
    .orderBy(sql`min(${auctionBids.createdAt})`);
  return new Map(rows.map((r, i) => [r.bidderId, i + 1]));
}

/** An auction past its end is closed on the spot by whoever reads it first (the scheduler does it otherwise). */
async function settleIfDue(row: AuctionRow, now: Date): Promise<AuctionRow> {
  const due = (row.status === "OPEN" && row.endsAt <= now) || (row.status === "AWAITING_DECISION" && row.decisionDeadline && row.decisionDeadline <= now);
  if (!due) return row;
  const outcome = await closeAuction(row.id, now);
  await announceClose(outcome);
  const [fresh] = await db.select().from(auctions).where(eq(auctions.id, row.id)).limit(1);
  return fresh ?? row;
}

/** The auction as a viewer sees it, or null when it does not exist (or its video was taken down). */
export async function auctionView(auctionId: string, viewerId: string | null): Promise<AuctionView | null> {
  const now = new Date();
  const [found] = await db.select().from(auctions).where(eq(auctions.id, auctionId)).limit(1);
  if (!found) return null;
  const row = await settleIfDue(found, now);

  const [meta] = await db
    .select({
      title: videos.title,
      thumbnailUrl: videos.thumbnailUrl,
      durationSeconds: videos.durationSeconds,
      removedAt: videos.removedAt,
      username: users.username,
      suspendedAt: users.suspendedAt,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(videos.id, row.videoId))
    .limit(1);
  const isCreator = viewerId === row.creatorId;
  if (!meta || meta.removedAt || (meta.suspendedAt && !isCreator)) return null;

  const [alias, bids, leader, grant, balance] = await Promise.all([
    aliases(row.id),
    db.select().from(auctionBids).where(eq(auctionBids.auctionId, row.id)).orderBy(desc(auctionBids.createdAt)).limit(12),
    isCreator && row.leaderId ? db.select({ username: users.username }).from(users).where(eq(users.id, row.leaderId)).limit(1) : Promise.resolve([]),
    viewerId
      ? db
          .select({ canDownload: videoAccessGrants.canDownload, via: videoAccessGrants.grantedVia })
          .from(videoAccessGrants)
          .where(and(eq(videoAccessGrants.videoId, row.videoId), eq(videoAccessGrants.userId, viewerId)))
          .limit(1)
      : Promise.resolve([]),
    viewerId && !isCreator ? getWalletBalanceCents(viewerId) : Promise.resolve(null),
  ]);

  const minimum = minimumNextBidCents(row);
  return {
    id: row.id,
    status: row.status,
    phase: auctionPhase(row, now),
    rights: row.rights,
    settlement: row.settlement,
    startingPriceCents: row.startingPriceCents,
    highestBidCents: row.highestBidCents,
    bidsCount: row.bidsCount,
    biddersCount: alias.size,
    minimumNextBidCents: minimum,
    suggestedBidsCents: suggestedBidsCents(minimum),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    scheduledEndsAt: row.scheduledEndsAt.toISOString(),
    decisionDeadline: row.decisionDeadline?.toISOString() ?? null,
    serverNow: now.toISOString(),
    video: { id: row.videoId, title: meta.title, thumbnailUrl: signMediaUrl(meta.thumbnailUrl), durationSeconds: meta.durationSeconds },
    creator: { username: meta.username, name: meta.displayName || meta.username, avatarUrl: meta.avatarUrl },
    leaderAlias: row.leaderId ? (alias.get(row.leaderId) ?? null) : null,
    leaderUsername: leader[0]?.username ?? null,
    recentBids: bids.map((b) => ({ id: b.id, amountCents: b.amountCents, alias: alias.get(b.bidderId) ?? 0, mine: b.bidderId === viewerId, createdAt: b.createdAt.toISOString() })),
    viewer: {
      signedIn: Boolean(viewerId),
      isCreator,
      isLeader: Boolean(viewerId) && row.leaderId === viewerId,
      alias: viewerId ? (alias.get(viewerId) ?? null) : null,
      won: row.status === "SOLD" && row.leaderId === viewerId,
      canDownload: isCreator || Boolean(grant[0]?.canDownload),
      balanceCents: balance,
    },
  };
}

/** The auction a video is in now (open, awaiting its decision, or sold), if any. */
export async function auctionIdForVideo(videoId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: auctions.id })
    .from(auctions)
    .where(and(eq(auctions.videoId, videoId), inArray(auctions.status, ["OPEN", "AWAITING_DECISION", "SOLD"])))
    .limit(1);
  return row?.id ?? null;
}

// ── Lists ─────────────────────────────────────────────────────────────────────────────────────

export const AUCTION_TABS = ["live", "upcoming", "ended", "bidding", "selling"] as const;
export type AuctionTab = (typeof AUCTION_TABS)[number];

export interface AuctionCardView {
  id: string;
  phase: AuctionPhase;
  rights: AuctionRow["rights"];
  settlement: AuctionRow["settlement"];
  highestBidCents: number;
  startingPriceCents: number;
  bidsCount: number;
  startsAt: string;
  endsAt: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  creatorUsername: string;
  creatorName: string;
  creatorAvatar: string | null;
  /** In "bidding": whether the viewer leads (or won). */
  leading?: boolean;
}

/**
 * A tab of the auctions page. live — ending soonest first; upcoming — starting soonest; ended — sold recently;
 * bidding — the viewer's auctions (where they bid); selling — the viewer's own auctions, every state.
 */
export async function listAuctions(tab: AuctionTab, viewerId: string | null, limit = 24): Promise<AuctionCardView[]> {
  const now = new Date();
  const visible = and(isNull(videos.removedAt), isNull(users.suspendedAt)) as SQL;
  let where: SQL | undefined;
  let order: SQL[] = [asc(auctions.endsAt)];
  switch (tab) {
    case "live":
      where = and(eq(auctions.status, "OPEN"), lte(auctions.startsAt, now), gt(auctions.endsAt, now));
      break;
    case "upcoming":
      where = and(eq(auctions.status, "OPEN"), gt(auctions.startsAt, now));
      order = [asc(auctions.startsAt)];
      break;
    case "ended":
      where = eq(auctions.status, "SOLD");
      order = [desc(auctions.settledAt)];
      break;
    case "bidding":
      if (!viewerId) return [];
      where = sql`exists (select 1 from auction_bids b where b.auction_id = ${auctions.id} and b.bidder_id = ${viewerId})`;
      order = [sql`case when ${auctions.status} = 'OPEN' then 0 else 1 end`, desc(auctions.endsAt)];
      break;
    case "selling":
      if (!viewerId) return [];
      where = eq(auctions.creatorId, viewerId);
      order = [sql`case ${auctions.status} when 'AWAITING_DECISION' then 0 when 'OPEN' then 1 else 2 end`, desc(auctions.createdAt)];
      break;
  }
  const rows = await db
    .select({
      a: auctions,
      title: videos.title,
      thumbnailUrl: videos.thumbnailUrl,
      creatorUsername: users.username,
      creatorName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      creatorAvatar: profiles.avatarUrl,
    })
    .from(auctions)
    .innerJoin(videos, eq(videos.id, auctions.videoId))
    .innerJoin(users, eq(users.id, auctions.creatorId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(where, tab === "selling" ? isNull(videos.removedAt) : visible))
    .orderBy(...order)
    .limit(limit);
  return rows.map(({ a, ...v }) => ({
    id: a.id,
    phase: auctionPhase(a, now),
    rights: a.rights,
    settlement: a.settlement,
    highestBidCents: a.highestBidCents,
    startingPriceCents: a.startingPriceCents,
    bidsCount: a.bidsCount,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    videoId: a.videoId,
    title: v.title,
    thumbnailUrl: signMediaUrl(v.thumbnailUrl),
    creatorUsername: v.creatorUsername,
    creatorName: v.creatorName,
    creatorAvatar: v.creatorAvatar,
    leading: tab === "bidding" ? a.leaderId === viewerId : undefined,
  }));
}

// ── Live feed and notifications ───────────────────────────────────────────────────────────────

/** What every viewer of an auction receives when someone bids (no identity: the alias only). */
export async function announceBid(input: { auction: AuctionRow; bidId: string; bidderId: string; amountCents: number; createdAt: Date; outbidUserId: string | null; extended: boolean }) {
  const alias = (await aliases(input.auction.id)).get(input.bidderId) ?? 0;
  const minimum = minimumNextBidCents(input.auction);
  await publish(auctionTopic(input.auction.id), {
    type: "bid",
    bid: { id: input.bidId, amountCents: input.amountCents, alias, createdAt: input.createdAt.toISOString() },
    highestBidCents: input.auction.highestBidCents,
    bidsCount: input.auction.bidsCount,
    leaderAlias: alias,
    endsAt: input.auction.endsAt.toISOString(),
    extended: input.extended,
    minimumNextBidCents: minimum,
    suggestedBidsCents: suggestedBidsCents(minimum),
  });
  return alias;
}

async function videoTitle(videoId: string): Promise<string> {
  const [row] = await db.select({ title: videos.title }).from(videos).where(eq(videos.id, videoId)).limit(1);
  return row?.title ?? "";
}

/** After a bid: the creator hears of it, and the bidder who was outbid gets their credits back and a nudge. */
export async function notifyBid(input: { auction: AuctionRow; amountCents: number; outbidUserId: string | null }) {
  const title = await videoTitle(input.auction.videoId);
  const path = `/watch/${input.auction.videoId}`;
  await notify({ userId: input.auction.creatorId, event: "auctionNewBid", vars: { title, amount: money(input.amountCents) }, path, emailThrottleKey: input.auction.id });
  if (input.outbidUserId) {
    await notify({ userId: input.outbidUserId, event: "auctionOutbid", vars: { title, amount: money(input.amountCents) }, path, emailThrottleKey: input.auction.id });
  }
}

/** Tells everyone watching that the auction changed state (they reload it), then notifies the people concerned. */
export async function announceClose(outcome: CloseOutcome | { kind: "CANCELLED"; auction: AuctionRow; releasedBidderId: string | null }) {
  if (outcome.kind === "NOOP") return;
  const { auction } = outcome;
  await publish(auctionTopic(auction.id), { type: "state", status: auction.status });
  const title = await videoTitle(auction.videoId);
  const path = `/watch/${auction.videoId}`;
  const amount = money(auction.highestBidCents);
  switch (outcome.kind) {
    case "SOLD":
      await notify({ userId: auction.creatorId, event: "auctionSold", vars: { title, amount }, path: "/auctions?tab=selling" });
      await notify({ userId: outcome.winnerId, event: "auctionWon", vars: { title, amount }, path });
      break;
    case "AWAITING_DECISION":
      await notify({ userId: auction.creatorId, event: "auctionDecision", vars: { title, amount }, path });
      break;
    case "UNSOLD":
      await notify({ userId: auction.creatorId, event: "auctionUnsold", vars: { title }, path: "/auctions?tab=selling" });
      break;
    case "DECLINED":
      if (outcome.bidderId) await notify({ userId: outcome.bidderId, event: "auctionDeclined", vars: { title, amount: money(outcome.amountCents) }, path: "/wallet" });
      break;
    case "CANCELLED":
      if (outcome.releasedBidderId) await notify({ userId: outcome.releasedBidderId, event: "auctionDeclined", vars: { title, amount }, path: "/wallet" });
      break;
  }
}

/** A new auction: the creator's approved followers hear of it (at most one e-mail per creator and day). */
export async function notifyAuctionAnnounced(auction: AuctionRow) {
  const title = await videoTitle(auction.videoId);
  const [creator] = await db
    .select({ name: sql<string>`coalesce(${profiles.displayName}, ${users.username})` })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, auction.creatorId))
    .limit(1);
  const followers = await db
    .select({ id: follows.followerId })
    .from(follows)
    .where(and(eq(follows.creatorId, auction.creatorId), eq(follows.status, "APPROVED")));
  for (const f of followers) {
    await notify({ userId: f.id, actorId: auction.creatorId, event: "auctionAnnounced", vars: { name: creator?.name ?? "", title }, path: `/watch/${auction.videoId}`, emailThrottleKey: auction.creatorId });
  }
}

/**
 * An operator stops what must not go on: the auctions of a video taken down, or of a suspended creator. The leading
 * bids' credits are released at once and their bidders told.
 */
export async function cancelAuctionsByOperator(where: { videoId?: string; creatorId?: string }, reason: string): Promise<number> {
  const ids = await liveAuctionIdsFor(where);
  for (const auctionId of ids) {
    const result = await cancelAuction({ auctionId, byOperator: true, reason });
    await announceClose({ kind: "CANCELLED", ...result });
  }
  return ids.length;
}

// ── Errors ────────────────────────────────────────────────────────────────────────────────────

/** An engine refusal as an HTTP answer: status, a plain message, and the details the UI shows (minimum, balance). */
export function auctionHttpError(error: unknown): { status: number; message: string; extra: Record<string, unknown> } | null {
  if (!(error instanceof AuctionError)) return null;
  const extra: Record<string, unknown> = { code: error.code, ...error.details };
  const map: Record<AuctionError["code"], [number, string]> = {
    NOT_FOUND: [404, "Auction not found"],
    VIDEO_NOT_READY: [409, "The video is still processing"],
    ALREADY_AUCTIONED: [409, "This video is already in an auction"],
    BAD_SCHEDULE: [400, "Check the start and end of the auction"],
    BAD_PRICE: [400, "The starting price is at least $1.00"],
    NOT_STARTED: [409, "The auction has not started yet"],
    NOT_OPEN: [409, "The auction is closed"],
    OWN_AUCTION: [403, "You cannot bid on your own auction"],
    BID_TOO_LOW: [409, "Your bid is below the minimum"],
    BID_TOO_HIGH: [400, "Your bid is above the maximum"],
    INSUFFICIENT_CREDITS: [402, "Not enough credits"],
    HAS_BIDS: [409, "An auction with bids cannot be cancelled"],
    NOT_AWAITING_DECISION: [409, "This auction is not waiting for your decision"],
  };
  const [status, message] = map[error.code];
  if (error.code === "INSUFFICIENT_CREDITS") extra.topUpUrl = "/wallet";
  return { status, message, extra };
}

/** Throws an HttpError for an auction id that is not a UUID (404, never 500). */
export function auctionIdOr404(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(404, "Auction not found");
  return id;
}
