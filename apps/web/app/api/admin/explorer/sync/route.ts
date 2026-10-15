import { NextResponse } from "next/server";

import { requireUserWithRole } from "@/lib/auth";
import { embedPending, explorerStatus } from "@/lib/explorer-index";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Embeds the discoverable videos that have no vector yet, now (the scheduler does it every ten minutes). */
export async function POST() {
  try {
    const admin = await requireUserWithRole(["ADMIN"]);
    await enforceRateLimit(`admin-explorer-sync:${admin.id}`, 6, 60, "Too many indexing requests. Wait a minute.");
    const summary = await embedPending({ limit: 200 });
    return NextResponse.json({ success: true, data: { summary, status: await explorerStatus() } });
  } catch (error) {
    return errorResponse(error, "admin/explorer/sync");
  }
}
