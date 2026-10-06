import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { dashboardFor } from "@/lib/queries";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    return NextResponse.json({ success: true, data: await dashboardFor(user) });
  } catch (error) {
    return errorResponse(error, "me/dashboard");
  }
}
