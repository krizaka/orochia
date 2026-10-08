import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, payoutRequests, users } from "@orochia/db";
import { desc, eq } from "drizzle-orm";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { openDetails } from "@/lib/payout-account";

function readableDestination(value: string): string {
  try {
    const details = openDetails(value);
    return typeof details === "string" ? details : Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(" · ");
  } catch {
    return "(cannot be decrypted with this PAYOUT_ENCRYPTION_KEY)";
  }
}

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
    // Operators send the money: the encrypted snapshot of the account is shown in clear, to them only.
    return NextResponse.json({ success: true, payouts: rows.map((r) => ({ ...r, payoutDestination: readableDestination(r.payoutDestination) })) });
  } catch (error) {
    return errorResponse(error, "admin/payouts");
  }
}
