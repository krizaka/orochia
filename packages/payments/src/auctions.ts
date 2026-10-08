import { db, auctions, auctionBids, videos, walletLedger } from "@orochia/db";
import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { getWalletBalanceCents } from "./credits";
import { creditTip, type LedgerExecutor } from "./ledger";
import {
  AUCTION_DECISION_WINDOW_MS,
  AUCTION_MAX_BID_CENTS,
  AUCTION_MIN_STARTING_PRICE_CENTS,
  checkAuctionSchedule,
  endAfterBid,
  minimumNextBidCents,
  type ScheduleProblem,
} from "./auction-rules";

/**
 * Auctions — the state machine and its money. Every transition runs in one transaction under the auction's row lock,
 * so bids, closing and the creator's decision serialise per auction and nothing is decided twice.
 *
 * Money: a bid holds the bidder's credits (wallet_ledger HOLD `hold_<bid>`, taken under the wallet's advisory lock, the
 * same one as every credit spend) for as long as it leads. Outbid, declined or cancelled, it is released
 * (RELEASE `release_<bid>`). Won, it is released and spent (SPEND `spend_auction_<auction>`) and the creator is credited
 * through the ledger like an unlock (CREATOR_CREDIT, gateway CREDITS, reference `auction_<auction>`), with the winner's
 * access grant. Each reference is unique, so a movement is written once whatever retries happen.
 */

export type AuctionRow = typeof auctions.$inferSelect;
export type AuctionRights = AuctionRow["rights"];
export type AuctionSettlement = AuctionRow["settlement"];

export type AuctionErrorCode =
  | "NOT_FOUND"
  | "VIDEO_NOT_READY"
  | "ALREADY_AUCTIONED"
  | "BAD_SCHEDULE"
  | "BAD_PRICE"
  | "NOT_STARTED"
  | "NOT_OPEN"
  | "OWN_AUCTION"
  | "BID_TOO_LOW"
  | "BID_TOO_HIGH"
  | "INSUFFICIENT_CREDITS"
  | "HAS_BIDS"
  | "NOT_AWAITING_DECISION";

/** A refused auction action; `details` carries what the caller needs to explain it (minimum, balance, problem). */
export class AuctionError extends Error {
  constructor(
    readonly code: AuctionErrorCode,
    readonly details: Record<string, string | number> = {},
  ) {
    super(code);
    this.name = "AuctionError";
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const walletLock = (tx: Tx, userId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`wallet:${userId}`}))`);

async function lockAuction(tx: Tx, auctionId: string, skipLocked = false): Promise<AuctionRow | undefined> {
  const query = tx.select().from(auctions).where(eq(auctions.id, auctionId)).limit(1);
  const [row] = await (skipLocked ? query.for("update", { skipLocked: true }) : query.for("update"));
  return row;
}

/** Gives a bid's held credits back and records why (once: the reference is unique). */
async function releaseBid(tx: Tx, bid: { id: string; bidderId: string; amountCents: number }, status: "OUTBID" | "RELEASED", note: string) {
  await tx.update(auctionBids).set({ status, releasedAt: new Date() }).where(eq(auctionBids.id, bid.id));
  await tx
    .insert(walletLedger)
    .values({ userId: bid.bidderId, entryType: "RELEASE", amountCents: bid.amountCents, reference: `release_${bid.id}`, note })
    .onConflictDoNothing();
}

/** The video goes back to the visibility it had before the auction (an auction that did not sell). */
async function restoreVisibility(tx: Tx, auction: AuctionRow) {
  await tx
    .update(videos)
    .set({ visibility: auction.previousVisibility, updatedAt: new Date() })
    .where(and(eq(videos.id, auction.videoId), eq(videos.visibility, "AUCTION")));
}

async function leadingBid(tx: Tx, auction: AuctionRow) {
  if (!auction.leadingBidId) return undefined;
  const [bid] = await tx.select().from(auctionBids).where(eq(auctionBids.id, auction.leadingBidId)).limit(1);
  return bid?.status === "LEADING" ? bid : undefined;
}

/** Sells to the leading bid: its credits are paid, the creator is credited, the winner gets their grant. */
async function sell(tx: Tx, auction: AuctionRow, now: Date): Promise<AuctionRow> {
  const bid = await leadingBid(tx, auction);
  if (!bid) throw new Error(`auction ${auction.id} has no leading bid to sell to`);
  await tx.update(auctionBids).set({ status: "WON" }).where(eq(auctionBids.id, bid.id));
  // The hold becomes the payment: released and spent in the same transaction, so the balance never moves.
  await tx
    .insert(walletLedger)
    .values([
      { userId: bid.bidderId, entryType: "RELEASE", amountCents: bid.amountCents, reference: `release_${bid.id}`, note: "Winning bid" },
      { userId: bid.bidderId, entryType: "SPEND", amountCents: -bid.amountCents, reference: `spend_auction_${auction.id}`, note: "Auction won" },
    ])
    .onConflictDoNothing();
  await creditTip(tx as LedgerExecutor, {
    senderId: bid.bidderId,
    creatorId: auction.creatorId,
    videoId: auction.videoId,
    grossAmountCents: bid.amountCents,
    gateway: "CREDITS",
    gatewayTransactionRef: `auction_${auction.id}`,
    note: "Auction sale",
    grant: { via: "AUCTION", canDownload: auction.rights === "DOWNLOAD" },
  });
  const [sold] = await tx
    .update(auctions)
    .set({ status: "SOLD", settledAt: now, closedAt: auction.closedAt ?? now, decisionDeadline: null, updatedAt: now })
    .where(eq(auctions.id, auction.id))
    .returning();
  return sold;
}

// ── Creating ──────────────────────────────────────────────────────────────────────────────────

export interface CreateAuctionInput {
  creatorId: string;
  videoId: string;
  startingPriceCents: number;
  startsAt: Date;
  endsAt: Date;
  rights: AuctionRights;
  settlement: AuctionSettlement;
}

/** Puts a creator's ready video up for auction; the video becomes AUCTION until the auction ends without a sale. */
export async function createAuction(input: CreateAuctionInput, now = new Date()): Promise<AuctionRow> {
  if (!Number.isInteger(input.startingPriceCents) || input.startingPriceCents < AUCTION_MIN_STARTING_PRICE_CENTS || input.startingPriceCents > AUCTION_MAX_BID_CENTS) {
    throw new AuctionError("BAD_PRICE", { minimum: AUCTION_MIN_STARTING_PRICE_CENTS });
  }
  const schedule = checkAuctionSchedule(input.startsAt, input.endsAt, now);
  if (!schedule.ok) throw new AuctionError("BAD_SCHEDULE", { problem: schedule.problem satisfies ScheduleProblem });

  return db.transaction(async (tx) => {
    const [video] = await tx
      .select()
      .from(videos)
      .where(and(eq(videos.id, input.videoId), eq(videos.creatorId, input.creatorId), isNull(videos.removedAt)))
      .for("update")
      .limit(1);
    if (!video) throw new AuctionError("NOT_FOUND");
    if (video.status !== "READY") throw new AuctionError("VIDEO_NOT_READY");
    const [active] = await tx
      .select({ id: auctions.id })
      .from(auctions)
      .where(and(eq(auctions.videoId, video.id), sql`${auctions.status} in ('OPEN', 'AWAITING_DECISION', 'SOLD')`))
      .limit(1);
    if (active) throw new AuctionError("ALREADY_AUCTIONED");

    const [auction] = await tx
      .insert(auctions)
      .values({
        videoId: video.id,
        creatorId: input.creatorId,
        rights: input.rights,
        settlement: input.settlement,
        startingPriceCents: input.startingPriceCents,
        startsAt: schedule.startsAt,
        endsAt: input.endsAt,
        scheduledEndsAt: input.endsAt,
        previousVisibility: video.visibility === "AUCTION" ? "PUBLIC" : video.visibility,
      })
      .returning();
    await tx.update(videos).set({ visibility: "AUCTION", updatedAt: now }).where(eq(videos.id, video.id));
    return auction;
  });
}

// ── Bidding ───────────────────────────────────────────────────────────────────────────────────

export interface BidOutcome {
  auction: AuctionRow;
  bid: typeof auctionBids.$inferSelect;
  /** The bidder who led before and whose credits were released (null when the leader raised their own bid). */
  outbidUserId: string | null;
  extended: boolean;
  balanceCents: number;
}

/**
 * Places a bid. Under the auction's lock: the auction is live, the bidder is not its creator, the amount reaches the
 * minimum; under the bidder's wallet lock: the credits are there. The previous leader's credits are released at once.
 */
export async function placeBid(input: { auctionId: string; bidderId: string; amountCents: number }, now = new Date()): Promise<BidOutcome> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new AuctionError("BID_TOO_LOW");
  if (input.amountCents > AUCTION_MAX_BID_CENTS) throw new AuctionError("BID_TOO_HIGH", { maximum: AUCTION_MAX_BID_CENTS });

  return db.transaction(async (tx) => {
    const auction = await lockAuction(tx, input.auctionId);
    if (!auction) throw new AuctionError("NOT_FOUND");
    const [video] = await tx.select({ removedAt: videos.removedAt }).from(videos).where(eq(videos.id, auction.videoId)).limit(1);
    if (!video || video.removedAt) throw new AuctionError("NOT_FOUND");
    if (auction.creatorId === input.bidderId) throw new AuctionError("OWN_AUCTION");
    if (auction.status !== "OPEN" || now >= auction.endsAt) throw new AuctionError("NOT_OPEN");
    if (now < auction.startsAt) throw new AuctionError("NOT_STARTED", { startsAt: auction.startsAt.toISOString() });

    const minimum = minimumNextBidCents(auction);
    if (input.amountCents < minimum) throw new AuctionError("BID_TOO_LOW", { minimum });

    const previous = await leadingBid(tx, auction);
    await walletLock(tx, input.bidderId);
    // The leading bid is released first (one bid holds credits at a time); when the leader raises their own bid, the
    // credits it held count towards the new one. A refusal below rolls the release back with everything else.
    if (previous) await releaseBid(tx, previous, "OUTBID", previous.bidderId === input.bidderId ? "Bid raised" : "Outbid");
    const balance = await getWalletBalanceCents(input.bidderId, tx);
    if (balance < input.amountCents) throw new AuctionError("INSUFFICIENT_CREDITS", { balance, minimum });

    const [bid] = await tx.insert(auctionBids).values({ auctionId: auction.id, bidderId: input.bidderId, amountCents: input.amountCents }).returning();
    await tx.insert(walletLedger).values({ userId: input.bidderId, entryType: "HOLD", amountCents: -input.amountCents, reference: `hold_${bid.id}`, note: "Auction bid" });

    const end = endAfterBid(auction.endsAt, now);
    const [updated] = await tx
      .update(auctions)
      .set({
        highestBidCents: input.amountCents,
        bidsCount: sql`${auctions.bidsCount} + 1`,
        leadingBidId: bid.id,
        leaderId: input.bidderId,
        endsAt: end.endsAt,
        updatedAt: now,
      })
      .where(eq(auctions.id, auction.id))
      .returning();

    return {
      auction: updated,
      bid,
      outbidUserId: previous && previous.bidderId !== input.bidderId ? previous.bidderId : null,
      extended: end.extended,
      balanceCents: balance - input.amountCents,
    };
  });
}

// ── Closing and deciding ──────────────────────────────────────────────────────────────────────

export type CloseOutcome =
  | { kind: "SOLD"; auction: AuctionRow; winnerId: string; amountCents: number }
  | { kind: "AWAITING_DECISION"; auction: AuctionRow }
  | { kind: "UNSOLD"; auction: AuctionRow }
  | { kind: "DECLINED"; auction: AuctionRow; bidderId: string; amountCents: number; expired: boolean }
  | { kind: "NOOP" };

/**
 * Moves an auction past its end: no bid → UNSOLD; the highest bid wins → SOLD; the creator decides →
 * AWAITING_DECISION (48 h). A decision left past its deadline is a decline. Idempotent: an auction not due is a NOOP,
 * and `skipLocked` lets several closers share the queue without waiting on each other.
 */
export async function closeAuction(auctionId: string, now = new Date(), { skipLocked = false } = {}): Promise<CloseOutcome> {
  return db.transaction(async (tx) => {
    const auction = await lockAuction(tx, auctionId, skipLocked);
    if (!auction) return { kind: "NOOP" } as const;

    if (auction.status === "AWAITING_DECISION" && auction.decisionDeadline && auction.decisionDeadline <= now) {
      const bid = await leadingBid(tx, auction);
      if (bid) await releaseBid(tx, bid, "RELEASED", "Bid not accepted in time");
      await restoreVisibility(tx, auction);
      const [declined] = await tx.update(auctions).set({ status: "DECLINED", decisionDeadline: null, updatedAt: now }).where(eq(auctions.id, auction.id)).returning();
      return { kind: "DECLINED", auction: declined, bidderId: bid?.bidderId ?? "", amountCents: bid?.amountCents ?? 0, expired: true } as const;
    }

    if (auction.status !== "OPEN" || auction.endsAt > now) return { kind: "NOOP" } as const;

    if (auction.bidsCount === 0 || !auction.leadingBidId) {
      await restoreVisibility(tx, auction);
      const [unsold] = await tx.update(auctions).set({ status: "UNSOLD", closedAt: now, updatedAt: now }).where(eq(auctions.id, auction.id)).returning();
      return { kind: "UNSOLD", auction: unsold } as const;
    }

    if (auction.settlement === "HIGHEST_BID") {
      const sold = await sell(tx, { ...auction, closedAt: now }, now);
      return { kind: "SOLD", auction: sold, winnerId: auction.leaderId ?? "", amountCents: auction.highestBidCents } as const;
    }

    const [awaiting] = await tx
      .update(auctions)
      .set({ status: "AWAITING_DECISION", closedAt: now, decisionDeadline: new Date(now.getTime() + AUCTION_DECISION_WINDOW_MS), updatedAt: now })
      .where(eq(auctions.id, auction.id))
      .returning();
    return { kind: "AWAITING_DECISION", auction: awaiting } as const;
  });
}

/** The creator accepts (sale) or declines (credits released) the best bid of an auction awaiting their decision. */
export async function decideAuction(input: { auctionId: string; creatorId: string; accept: boolean }, now = new Date()): Promise<CloseOutcome> {
  return db.transaction(async (tx) => {
    const auction = await lockAuction(tx, input.auctionId);
    if (!auction || auction.creatorId !== input.creatorId) throw new AuctionError("NOT_FOUND");
    if (auction.status !== "AWAITING_DECISION") throw new AuctionError("NOT_AWAITING_DECISION");
    const bid = await leadingBid(tx, auction);
    if (!bid) throw new AuctionError("NOT_AWAITING_DECISION");
    if (input.accept) {
      const sold = await sell(tx, auction, now);
      return { kind: "SOLD", auction: sold, winnerId: bid.bidderId, amountCents: bid.amountCents } as const;
    }
    await releaseBid(tx, bid, "RELEASED", "Bid declined");
    await restoreVisibility(tx, auction);
    const [declined] = await tx.update(auctions).set({ status: "DECLINED", decisionDeadline: null, updatedAt: now }).where(eq(auctions.id, auction.id)).returning();
    return { kind: "DECLINED", auction: declined, bidderId: bid.bidderId, amountCents: bid.amountCents, expired: false } as const;
  });
}

/**
 * Cancels an auction. Its creator may do so while nobody has bid; an operator (`byOperator`) at any point before a sale
 * — a takedown, a suspension — and the leading bid's credits are released.
 */
export async function cancelAuction(
  input: { auctionId: string; creatorId?: string; byOperator?: boolean; reason: string },
  now = new Date(),
): Promise<{ auction: AuctionRow; releasedBidderId: string | null }> {
  return db.transaction(async (tx) => {
    const auction = await lockAuction(tx, input.auctionId);
    if (!auction || (!input.byOperator && auction.creatorId !== input.creatorId)) throw new AuctionError("NOT_FOUND");
    if (auction.status !== "OPEN" && !(input.byOperator && auction.status === "AWAITING_DECISION")) throw new AuctionError("NOT_OPEN");
    if (!input.byOperator && auction.bidsCount > 0) throw new AuctionError("HAS_BIDS");
    const bid = await leadingBid(tx, auction);
    if (bid) await releaseBid(tx, bid, "RELEASED", "Auction cancelled");
    await restoreVisibility(tx, auction);
    const [cancelled] = await tx
      .update(auctions)
      .set({ status: "CANCELLED", cancelReason: input.reason, closedAt: now, decisionDeadline: null, updatedAt: now })
      .where(eq(auctions.id, auction.id))
      .returning();
    return { auction: cancelled, releasedBidderId: bid?.bidderId ?? null };
  });
}

/** Auctions with work to do: open ones past their end and decisions past their deadline, oldest first. */
export async function dueAuctionIds(now = new Date(), limit = 25): Promise<string[]> {
  const rows = await db
    .select({ id: auctions.id })
    .from(auctions)
    .where(
      or(
        and(eq(auctions.status, "OPEN"), lte(auctions.endsAt, now)),
        and(eq(auctions.status, "AWAITING_DECISION"), lte(auctions.decisionDeadline, now)),
      ),
    )
    .orderBy(asc(auctions.endsAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

/** The auctions an operator action must stop: everything not final on a video, or on every video of a creator. */
export async function liveAuctionIdsFor(where: { videoId?: string; creatorId?: string }): Promise<string[]> {
  const rows = await db
    .select({ id: auctions.id })
    .from(auctions)
    .where(
      and(
        sql`${auctions.status} in ('OPEN', 'AWAITING_DECISION')`,
        where.videoId ? eq(auctions.videoId, where.videoId) : undefined,
        where.creatorId ? eq(auctions.creatorId, where.creatorId) : undefined,
      ),
    );
  return rows.map((r) => r.id);
}

/** Credits an account has held behind its leading bids (already out of its balance, given back if outbid). */
export async function heldInBidsCents(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${auctionBids.amountCents}), 0)` })
    .from(auctionBids)
    .where(and(eq(auctionBids.bidderId, userId), eq(auctionBids.status, "LEADING")));
  return Number(row?.total ?? 0);
}
