import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { challengeConfig } from "@/lib/abuse/turnstile";
import { requireUserWithRole } from "@/lib/auth";
import { requireBunnyStream } from "@/lib/env";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit, rateLimitStore } from "@/lib/rate-limit";
import { reconcileStorage } from "@/lib/storage-reconcile";
import { adminStorageOverview } from "@/lib/storage-usage";

export const dynamic = "force-dynamic";

/**
 * Platform storage for operators: usage against the cap and alert thresholds, the plans, the largest accounts, the last
 * reconciliation with Bunny, and the state of the abuse defences (rate-limit store, bot challenge).
 */
export async function GET(req: NextRequest) {
  try {
    await requireUserWithRole(["ADMIN"]);
    const top = z.coerce.number().int().min(1).max(100).catch(20).parse(req.nextUrl.searchParams.get("top") ?? 20);
    const overview = await adminStorageOverview({ top });
    let challenge: { mode: string; active: boolean } | { error: string };
    try {
      const config = challengeConfig();
      challenge = { mode: config.mode, active: config.active };
    } catch (error) {
      challenge = { error: error instanceof Error ? error.message : "invalid" };
    }
    return NextResponse.json({ success: true, storage: overview, defences: { rateLimitStore: rateLimitStore().name, challenge } });
  } catch (error) {
    return errorResponse(error, "admin/storage");
  }
}

/** Reconciles the storage counters with Bunny now (lists the Stream library; at most a few times an hour). */
export async function POST() {
  try {
    const admin = await requireUserWithRole(["ADMIN"]);
    await enforceRateLimit(`storage-reconcile:${admin.id}`, 6, 60 * 60, "Too many reconciliations. Try again later.");
    requireBunnyStream();
    return NextResponse.json({ success: true, result: await reconcileStorage() });
  } catch (error) {
    return errorResponse(error, "admin/storage/reconcile");
  }
}
