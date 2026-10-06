import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { metricsToken } from "@/lib/env";
import { checkDbHealth } from "@orochia/db";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

function authorised(req: NextRequest, token: string | null): boolean {
  if (!token) return true; // development only: metricsToken() throws in production when unset
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** Prometheus metrics, behind a bearer token (METRICS_AUTH_TOKEN). */
export async function GET(req: NextRequest) {
  try {
    if (!authorised(req, metricsToken())) return jsonError(401, "Unauthorized");
    const memory = process.memoryUsage();
    const dbUp = (await checkDbHealth()) ? 1 : 0;
    const body = [
      "# HELP orochia_process_uptime_seconds Process uptime in seconds",
      "# TYPE orochia_process_uptime_seconds gauge",
      `orochia_process_uptime_seconds ${process.uptime()}`,
      "# HELP orochia_memory_heap_used_bytes Heap used in bytes",
      "# TYPE orochia_memory_heap_used_bytes gauge",
      `orochia_memory_heap_used_bytes ${memory.heapUsed}`,
      "# HELP orochia_memory_rss_bytes Resident set size in bytes",
      "# TYPE orochia_memory_rss_bytes gauge",
      `orochia_memory_rss_bytes ${memory.rss}`,
      "# HELP orochia_database_up Database reachable (1) or not (0)",
      "# TYPE orochia_database_up gauge",
      `orochia_database_up ${dbUp}`,
      "",
    ].join("\n");
    return new NextResponse(body, { headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" } });
  } catch (error) {
    return errorResponse(error, "metrics");
  }
}
