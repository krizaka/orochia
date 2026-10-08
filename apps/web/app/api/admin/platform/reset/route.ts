import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";
import { resetDatabase } from "@/lib/platform";

export const dynamic = "force-dynamic";

const Reset = z.object({ confirm: z.string().max(200), backup: z.boolean().default(true) });

/**
 * Factory reset: backs the database up first (unless asked not to), wipes it and rebuilds it from the migrations — development deployments only (OROCHIA_ALLOW_DATABASE_RESET,
 * never the indexed production), after the operator typed “reset <database>”. The operator and the owner are kept.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireUserWithRole(["ADMIN"]);
    if (!(await checkRateLimit(`platform-reset:${admin.id}`, 3, 60 * 60)).success) return jsonError(429, "Too many resets. Try again later.");
    const { confirm, backup } = Reset.parse(await req.json());
    return NextResponse.json({ success: true, ...(await resetDatabase({ operatorId: admin.id, confirm, backup })) });
  } catch (error) {
    return errorResponse(error, "admin/platform/reset");
  }
}
