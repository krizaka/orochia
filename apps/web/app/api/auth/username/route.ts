import { NextRequest, NextResponse } from "next/server";
import { checkUsername } from "@/lib/usernames";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Whether a username is free (unique address orochia.com/@username), with a free one suggested when it is not. */
export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!(await checkRateLimit(`username-check:${ip}`, 120, 60)).success) return jsonError(429, "Too many checks. Slow down.");
    return NextResponse.json({ success: true, ...(await checkUsername(req.nextUrl.searchParams.get("username") ?? "")) });
  } catch (error) {
    return errorResponse(error, "auth/username");
  }
}
