import { db, tipsLedger, videoAccessGrants, profiles, videos, payoutRequests } from "@orochia/db";
import { eq, sql } from "drizzle-orm";
import { GatewayType } from "./types";

export interface RecordTipOptions {
  senderId?: string;
  creatorId: string;
  videoId?: string;
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

/**
 * Atomically records a creator tip, extracts platform fee, credits creator ledger,
 * updates profile/video counters, and provisions a video access grant if applicable.
 */
export async function recordTipAndUnlock(options: RecordTipOptions): Promise<TipResult> {
  const feePct = parseInt(process.env.PLATFORM_FEE_PERCENTAGE || "10", 10);
  const platformFeeCents = Math.round(options.grossAmountCents * (feePct / 100));
  const netAmountCents = options.grossAmountCents - platformFeeCents;

  return await db.transaction(async (tx) => {
    // 1. If video is provided, verify minimum unlock requirements
    if (options.videoId) {
      const [targetVideo] = await tx
        .select()
        .from(videos)
        .where(eq(videos.id, options.videoId))
        .limit(1);

      if (targetVideo && targetVideo.minTipAmountCents > options.grossAmountCents) {
        throw new Error(
          `Tip amount of $${(options.grossAmountCents / 100).toFixed(
            2
          )} is below required minimum of $${(targetVideo.minTipAmountCents / 100).toFixed(2)} to unlock.`
        );
      }
    }

    // 2. Insert primary ledger credit record
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

    // 3. Increment creator earnings counter in profile
    await tx
      .update(profiles)
      .set({
        totalTipsEarnedCents: sql`${profiles.totalTipsEarnedCents} + ${netAmountCents}`,
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, options.creatorId));

    // 4. Update video tip counter if tied to a specific video
    let grantId: string | undefined;
    if (options.videoId) {
      await tx
        .update(videos)
        .set({
          tipsCount: sql`${videos.tipsCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(videos.id, options.videoId));

      // 5. If sender is identified, provision a VideoAccessGrant
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
  });
}

/**
 * Calculates current available un-payout balance for a creator.
 */
export async function getCreatorAvailableBalanceCents(creatorId: string): Promise<number> {
  const result = await db
    .select({
      totalNetEarnings: sql<number>`coalesce(sum(${tipsLedger.netAmountCents}), 0)`,
    })
    .from(tipsLedger)
    .where(eq(tipsLedger.creatorId, creatorId));

  const totalCredits = Number(result[0]?.totalNetEarnings || 0);

  const payoutResult = await db
    .select({
      totalPaidOut: sql<number>`coalesce(sum(${payoutRequests.amountCents}), 0)`,
    })
    .from(payoutRequests)
    .where(
      sql`${payoutRequests.creatorId} = ${creatorId} AND ${payoutRequests.status} NOT IN ('FAILED')`
    );

  const totalPaidOut = Number(payoutResult[0]?.totalPaidOut || 0);

  return Math.max(0, totalCredits - totalPaidOut);
}

/**
 * Submits a creator payout request with atomic balance verification.
 */
export async function requestPayout(
  creatorId: string,
  amountCents: number,
  payoutMethod: string,
  payoutDestination: string
) {
  return await db.transaction(async (tx) => {
    const available = await getCreatorAvailableBalanceCents(creatorId);
    if (available < amountCents) {
      throw new Error(
        `Insufficient available creator balance ($${(available / 100).toFixed(
          2
        )}) for payout request ($${(amountCents / 100).toFixed(2)}).`
      );
    }

    const [request] = await tx
      .insert(payoutRequests)
      .values({
        creatorId,
        amountCents,
        payoutMethod,
        payoutDestination,
        status: "REQUESTED",
      })
      .returning();

    // Log corresponding ledger entry for tracking
    await tx.insert(tipsLedger)
      .values({
        entryType: "PAYOUT_REQUESTED",
        creatorId,
        grossAmountCents: amountCents,
        platformFeeCents: 0,
        netAmountCents: -amountCents,
        gateway: "CRYPTO", // or generic
        gatewayTransactionRef: `payout_req_${request.id}`,
        note: `Payout requested via ${payoutMethod}`,
      });

    return request;
  });
}
