import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { consumeToken, markEmailVerified } from "@/lib/account-tokens";
import { getSession, setSessionCookie } from "@/lib/auth";
import { ipKey } from "@/lib/client-ip";
import { errorResponse, jsonError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Verifies an e-mail address with the link's one-time token (48 h); refreshes the session of that account. */
export async function POST(req: NextRequest) {
  try {
    const ip = ipKey(req.headers);
    await enforceRateLimit(`verify-email:${ip}`, 20, 60 * 60, "Too many attempts. Try again later.");
    const { token } = z.object({ token: z.string().min(1).max(200) }).parse(await req.json());
    const userId = await consumeToken(token, "VERIFY_EMAIL");
    if (!userId) return jsonError(400, "This link is invalid or has expired. Ask for a new one.");
    await markEmailVerified(userId);
    const response = NextResponse.json({ success: true });
    const session = await getSession();
    if (session?.id === userId) setSessionCookie(response, { ...session, emailVerified: true });
    return response;
  } catch (error) {
    return errorResponse(error, "auth/verify-email");
  }
}
