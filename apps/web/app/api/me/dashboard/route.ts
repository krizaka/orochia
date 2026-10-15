import { NextResponse } from "next/server";
import { requireUserWithRole } from "@/lib/auth";
import { dashboardFor } from "@/lib/queries";
import { errorResponse } from "@/lib/http";
import { reconcileVideos } from "@/lib/video-reconcile";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    // A creator's own uploads: ask Bunny about those still unsettled (the webhook may never come) before answering.
    if (user.role === "CREATOR" || user.role === "ADMIN") await reconcileVideos({ creatorId: user.id, limit: 10 }).catch(() => undefined);
    return NextResponse.json({ success: true, data: await dashboardFor(user) });
  } catch (error) {
    return errorResponse(error, "me/dashboard");
  }
}
