import { NextResponse } from "next/server";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { storageOverview } from "@/lib/storage-usage";

export const dynamic = "force-dynamic";

/** Your storage: space and video time used against your plan, uploads on hold, today's uploads and the per-file limits. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    return NextResponse.json({ success: true, storage: await storageOverview(user.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error, "me/storage");
  }
}
