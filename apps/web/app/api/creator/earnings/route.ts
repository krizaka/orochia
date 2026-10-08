import { NextRequest, NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { PERIODS, type Period, earningLines, earningsSummary, monthlyNet, payoutHistory, videoEarnings } from "@/lib/earnings";
import { getPayoutAccount } from "@/lib/payout-account";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Your earnings for a period (?period=30d|90d|12m|all): totals, views, each video's revenue, the trend, payments and payouts. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    const asked = req.nextUrl.searchParams.get("period");
    const period: Period = (PERIODS as readonly string[]).includes(asked ?? "") ? (asked as Period) : "30d";
    const [summary, videos, monthly, lines, payouts, payoutAccount] = await Promise.all([
      earningsSummary(user.id, period),
      videoEarnings(user.id, period),
      monthlyNet(user.id),
      earningLines(user.id, period, 50),
      payoutHistory(user.id),
      getPayoutAccount(user.id),
    ]);
    return NextResponse.json({ success: true, period, summary, videos, monthly, lines, payouts, payoutAccount });
  } catch (error) {
    return errorResponse(error, "creator/earnings");
  }
}
