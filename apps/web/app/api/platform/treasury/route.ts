import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { treasury } from "@/lib/queries";
import { platformFeePercent } from "@orochia/payments";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Platform revenue, computed from the ledger only (administrators). */
export async function GET() {
  try {
    await requireUserWithRole(["ADMIN"]);
    return NextResponse.json({
      success: true,
      currency: "USD",
      data: { protocolRakePercent: platformFeePercent(), ...(await treasury()) },
    });
  } catch (error) {
    return errorResponse(error, "treasury");
  }
}
