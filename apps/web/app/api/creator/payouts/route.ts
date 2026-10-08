import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, payoutRequests, tipsLedger } from "@orochia/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { getCreatorAvailableBalanceCents, platformFeePercent, requestPayout } from "@orochia/payments";
import { requireUserWithRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";
import { payoutDestinationOf } from "@/lib/payout-account";

export const dynamic = "force-dynamic";

/** The signed-in creator's balance, lifetime earnings and payout history — from the ledger. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const [lifetime] = await db
      .select({ total: sql<string>`coalesce(sum(${tipsLedger.netAmountCents}), 0)`, count: sql<string>`count(*)` })
      .from(tipsLedger)
      .where(and(eq(tipsLedger.creatorId, user.id), eq(tipsLedger.entryType, "CREATOR_CREDIT")));
    const history = await db
      .select()
      .from(payoutRequests)
      .where(eq(payoutRequests.creatorId, user.id))
      .orderBy(desc(payoutRequests.createdAt))
      .limit(50);
    return NextResponse.json({
      success: true,
      data: {
        availableCents: await getCreatorAvailableBalanceCents(user.id),
        lifetimeNetCents: Number(lifetime?.total ?? 0),
        creditsCount: Number(lifetime?.count ?? 0),
        platformFeePercent: platformFeePercent(),
        history,
      },
    });
  } catch (error) {
    return errorResponse(error, "creator/payouts/get");
  }
}

const PayoutSchema = z.object({ amountCents: z.number().int().min(2000, "The minimum payout is $20.00") });

/** Requests a payout to your saved payout account (an encrypted snapshot is kept); balance checked and reserved atomically. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const limit = await checkRateLimit(`payout:${user.id}`, 5, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many payout requests. Try again later.");
    const input = PayoutSchema.parse(await req.json());
    try {
      const destination = await payoutDestinationOf(user.id);
      const request = await requestPayout(user.id, input.amountCents, destination.method, destination.sealed);
      return NextResponse.json({ success: true, request }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Insufficient")) return jsonError(400, error.message);
      throw error;
    }
  } catch (error) {
    return errorResponse(error, "creator/payouts/post");
  }
}
