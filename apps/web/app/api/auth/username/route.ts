import { NextRequest, NextResponse } from "next/server";

import { ipKey } from "@/lib/client-ip";
import { errorResponse } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { checkUsername } from "@/lib/usernames";

export const dynamic = "force-dynamic";

/** Whether a username is free (unique address orochia.com/@username), with a free one suggested when it is not. */
export async function GET(req: NextRequest) {
  try {
    const ip = ipKey(req.headers);
    await enforceRateLimit(`username-check:${ip}`, 120, 60, "Too many checks. Slow down.");
    return NextResponse.json({ success: true, ...(await checkUsername(req.nextUrl.searchParams.get("username") ?? "")) });
  } catch (error) {
    return errorResponse(error, "auth/username");
  }
}
