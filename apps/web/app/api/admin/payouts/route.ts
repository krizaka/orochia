import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, payoutRequests, users } from "@orochia/db";
import { desc, eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const Status = z.enum(["REQUESTED", "UNDER_REVIEW", "PROCESSING", "SETTLED", "FAILED"]);

/** Payout requests with their creator; `?status=` filters. */
export async function GET(req: NextRequest) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const status = Status.safeParse(new URL(req.url).searchParams.get("status"));
    const rows = await db
      .select({
        id: payoutRequests.id,
        amountCents: payoutRequests.amountCents,
        status: payoutRequests.status,
        payoutMethod: payoutRequests.payoutMethod,
        payoutDestination: payoutRequests.payoutDestination,
        txHashOrReference: payoutRequests.txHashOrReference,
        failureReason: payoutRequests.failureReason,
        createdAt: payoutRequests.createdAt,
        creatorUsername: users.username,
      })
      .from(payoutRequests)
      .innerJoin(users, eq(users.id, payoutRequests.creatorId))
      .where(status.success ? eq(payoutRequests.status, status.data) : undefined)
      .orderBy(desc(payoutRequests.createdAt))
      .limit(200);
    return NextResponse.json({ success: true, payouts: rows });
  } catch (error) {
    return errorResponse(error, "admin/payouts");
  }
}
