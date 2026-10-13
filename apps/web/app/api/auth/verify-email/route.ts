import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { consumeToken, markEmailVerified } from "@/lib/account-tokens";
import { getSession, SESSION_TTL_SECONDS, sessionTransport, setSessionCookie, signSessionToken } from "@/lib/auth";
import { ipKey } from "@/lib/client-ip";
import { errorResponse, jsonError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Verifies an e-mail address with the link's one-time token (48 h); refreshes the session of that account — the cookie
 * of a browser, or, for a native app's bearer session, a new `token` in the answer. Never a cookie for a bearer session:
 * a native HTTP stack keeps it in a jar that outlives the app's sign-out (krizaka/orochia#127).
 */
export async function POST(req: NextRequest) {
  try {
    const ip = ipKey(req.headers);
    await enforceRateLimit(`verify-email:${ip}`, 20, 60 * 60, "Too many attempts. Try again later.");
    const { token } = z.object({ token: z.string().min(1).max(200) }).parse(await req.json());
    const userId = await consumeToken(token, "VERIFY_EMAIL");
    if (!userId) return jsonError(400, "This link is invalid or has expired. Ask for a new one.");
    await markEmailVerified(userId);
    const session = await getSession();
    const refreshed = session?.id === userId ? { ...session, emailVerified: true } : null;
    if (refreshed && (await sessionTransport()) === "bearer") {
      return NextResponse.json({ success: true, token: signSessionToken(refreshed), expiresIn: SESSION_TTL_SECONDS });
    }
    const response = NextResponse.json({ success: true });
    if (refreshed) setSessionCookie(response, refreshed);
    return response;
  } catch (error) {
    return errorResponse(error, "auth/verify-email");
  }
}
