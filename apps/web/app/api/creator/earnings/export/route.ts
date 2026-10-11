import { NextRequest } from "next/server";

import { requireUserWithRole } from "@/lib/auth";
import { earningLines, type Period, PERIODS, transactionsCsv, videoEarnings, videosCsv } from "@/lib/earnings";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Downloads your earnings as CSV (?kind=transactions|videos&period=…), for your accounting. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    await enforceRateLimit(`earnings-export:${user.id}`, 30, 60 * 60, "Too many exports. Try again later.");
    const asked = req.nextUrl.searchParams.get("period");
    const period: Period = (PERIODS as readonly string[]).includes(asked ?? "") ? (asked as Period) : "all";
    const kind = req.nextUrl.searchParams.get("kind") === "videos" ? "videos" : "transactions";
    const csv = kind === "videos" ? videosCsv(await videoEarnings(user.id, period)) : transactionsCsv(await earningLines(user.id, period));
    const name = `orochia-${kind}-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response("﻿" + csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, "creator/earnings/export");
  }
}
