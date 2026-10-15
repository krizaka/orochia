import { NextResponse } from "next/server";

import { requireUserWithRole } from "@/lib/auth";
import { explorerStatus } from "@/lib/explorer-index";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Operator view of the Explorer — the proof that Orochia's AI runs on Orazaka: whether the engine is configured (its host,
 * never its key), the circuit breaker, how many discoverable videos have a vector, and the latest calls to Orazaka with the
 * run id Orazaka answered (find `embedding.run runId=…` in its logs). Counts, ids and timings only; never a search text.
 */
export async function GET() {
  try {
    await requireUserWithRole(["ADMIN"]);
    return NextResponse.json({ success: true, data: await explorerStatus() });
  } catch (error) {
    return errorResponse(error, "admin/explorer");
  }
}
