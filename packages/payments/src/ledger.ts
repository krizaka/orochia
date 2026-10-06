import { db, tipsLedger, videoAccessGrants, profiles, videos, payoutRequests } from "@orochia/db";
import { and, eq, ne, sql } from "drizzle-orm";
import { GatewayType } from "./types";

/** A database handle or an open transaction — every ledger write can join a caller's transaction. */
export type LedgerExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export interface RecordTipOptions {
  senderId?: string | null;
  creatorId: string;
  videoId?: string | null;
  grossAmountCents: number;
  gateway: GatewayType;
  gatewayTransactionRef: string;
  note?: string;
}

export interface TipResult {
  ledgerId: string;
  grantId?: string;
  grossAmountCents: number;
  platformFeeCents: number;
  netAmountCents: number;
}

/** The platform fee percentage (0–100), from PLATFORM_FEE_PERCENTAGE; 10 by default. */
export function platformFeePercent(env: Record<string, string | undefined> = process.env): number {
  const raw = env.PLATFORM_FEE_PERCENTAGE;
  const pct = raw === undefined || raw === "" ? 10 : Number(raw);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error(`PLATFORM_FEE_PERCENTAGE must be between 0 and 100 (got ${raw})`);
  }
  return pct;
}

/** Splits a gross amount into platform fee and creator net; the two always add up to the gross. */
export function splitPlatformFee(grossAmountCents: number, feePercent: number) {
  if (!Number.isInteger(grossAmountCents) || grossAmountCents <= 0) {
    throw new Error("gross amount must be a positive integer number of cents");
  }
  const platformFeeCents = Math.round(grossAmountCents * (feePercent / 100));
  return { platformFeeCents, netAmountCents: grossAmountCents - platformFeeCents };
}

/**
 * Records a creator credit, its platform fee, the counters it moves and — for a video — the
 * buyer's access grant, inside the caller's transaction.
 */
export async function creditTip(tx: LedgerExecutor, options: RecordTipOptions): Promise<TipResult> {
  const { platformFeeCents, netAmountCents } = splitPlatformFee(options.grossAmountCents, platformFeePercent());

  if (options.videoId) {
    const [targetVideo] = await tx.select().from(videos).where(eq(videos.id, options.videoId)).limit(1);
    if (!targetVideo) throw new Error("Video not found");
    if (targetVideo.creatorId !== options.creatorId) throw new Error("Video does not belong to creator");
    if (targetVideo.minTipAmountCents > options.grossAmountCents) {
      throw new Error("Amount is below the video's unlock minimum");
    }
  }

  const [ledgerEntry] = await tx
    .insert(tipsLedger)
    .values({
      entryType: "CREATOR_CREDIT",
      senderId: options.senderId || null,
      creatorId: options.creatorId,
      videoId: options.videoId || null,
      grossAmountCents: options.grossAmountCents,
      platformFeeCents,
      netAmountCents,
      gateway: options.gateway,
      gatewayTransactionRef: options.gatewayTransactionRef,
      note: options.note || "Creator tip & video unlock",
    })
    .returning();

  await tx
    .update(profiles)
    .set({
      totalTipsEarnedCents: sql`${profiles.totalTipsEarnedCents} + ${netAmountCents}`,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, options.creatorId));

  let grantId: string | undefined;
  if (options.videoId) {
    await tx
      .update(videos)
      .set({ tipsCount: sql`${videos.tipsCount} + 1`, updatedAt: new Date() })
      .where(eq(videos.id, options.videoId));

    if (options.senderId) {
      const [grant] = await tx
        .insert(videoAccessGrants)
        .values({
          videoId: options.videoId,
          userId: options.senderId,
          grantedVia: "TIP_PAYMENT",
          amountPaidCents: options.grossAmountCents,
          transactionRef: options.gatewayTransactionRef,
        })
        .onConflictDoNothing()
        .returning();
      grantId = grant?.id;
    }
  }

  return {
    ledgerId: ledgerEntry.id,
    grantId,
    grossAmountCents: options.grossAmountCents,
    platformFeeCents,
    netAmountCents,
  };
}

/** {@link creditTip} in its own transaction. */
export async function recordTipAndUnlock(options: RecordTipOptions): Promise<TipResult> {
  return db.transaction((tx) => creditTip(tx, options));
}

/**
 * A creator's balance available for payout: every credit received minus every payout that has
 * not failed. Credits and payouts are each counted once — payout ledger rows are a journal of the
 * same payouts and are not subtracted a second time.
 */
export async function getCreatorAvailableBalanceCents(
  creatorId: string,
  executor: LedgerExecutor = db,
): Promise<number> {
  const [credits] = await executor
    .select({ total: sql<string>`coalesce(sum(${tipsLedger.netAmountCents}), 0)` })
    .from(tipsLedger)
    .where(and(eq(tipsLedger.creatorId, creatorId), eq(tipsLedger.entryType, "CREATOR_CREDIT")));

  const [payouts] = await executor
    .select({ total: sql<string>`coalesce(sum(${payoutRequests.amountCents}), 0)` })
    .from(payoutRequests)
    .where(and(eq(payoutRequests.creatorId, creatorId), ne(payoutRequests.status, "FAILED")));

  return Math.max(0, Number(credits?.total ?? 0) - Number(payouts?.total ?? 0));
}

/**
 * Submits a payout request. Concurrent requests of one creator are serialised by a transaction
 * lock, so two requests can never both spend the same balance.
 */
export async function requestPayout(
  creatorId: string,
  amountCents: number,
  payoutMethod: string,
  payoutDestination: string,
) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Payout amount must be a positive integer number of cents");
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${creatorId}))`);

    const available = await getCreatorAvailableBalanceCents(creatorId, tx);
    if (available < amountCents) {
      throw new Error(
        `Insufficient available creator balance ($${(available / 100).toFixed(2)}) for payout request ($${(
          amountCents / 100
        ).toFixed(2)}).`,
      );
    }

    const [request] = await tx
      .insert(payoutRequests)
      .values({ creatorId, amountCents, payoutMethod, payoutDestination, status: "REQUESTED" })
      .returning();

    await tx.insert(tipsLedger).values({
      entryType: "PAYOUT_REQUESTED",
      creatorId,
      grossAmountCents: amountCents,
      platformFeeCents: 0,
      netAmountCents: -amountCents,
      gateway: "CRYPTO",
      gatewayTransactionRef: `payout_req_${request.id}`,
      note: `Payout requested via ${payoutMethod}`,
    });

    return request;
  });
}
