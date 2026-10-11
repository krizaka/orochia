import { NextResponse } from "next/server";
import { db, complianceReports, payoutRequests, users } from "@orochia/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { platformFeePercent } from "@orochia/payments";
import { adminTrends } from "@/lib/admin-trends";
import { requireUserWithRole } from "@/lib/auth";
import { catalogueStats, treasury } from "@/lib/queries";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Operator overview: money, catalogue, the three queues that need a human, and 12 months of revenue and reports. */
export async function GET() {
  try {
    await requireUserWithRole(["ADMIN"]);
    const [[reports], [creators], [payouts], money, catalogue, trends] = await Promise.all([
      db.select({ count: sql<string>`count(*)` }).from(complianceReports).where(inArray(complianceReports.status, ["OPEN", "IN_REVIEW"])),
      db.select({ count: sql<string>`count(*)` }).from(users).where(and(eq(users.role, "CREATOR"), eq(users.isVerified, false))),
      db.select({ count: sql<string>`count(*)` }).from(payoutRequests).where(inArray(payoutRequests.status, ["REQUESTED", "UNDER_REVIEW", "PROCESSING"])),
      treasury(),
      catalogueStats(),
      adminTrends(),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        treasury: { ...money, protocolRakePercent: platformFeePercent() },
        catalogue,
        trends,
        queues: {
          openReports: Number(reports?.count ?? 0),
          creatorsAwaitingVerification: Number(creators?.count ?? 0),
          payoutsInProgress: Number(payouts?.count ?? 0),
        },
      },
    });
  } catch (error) {
    return errorResponse(error, "admin/overview");
  }
}
