import { NextResponse } from "next/server";
import { getSession, SESSION_TTL_SECONDS, sessionTransport, setSessionCookie, signSessionToken } from "@/lib/auth";
import { accountProfile } from "@/lib/queries";
import { isDemoMode } from "@/lib/env";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * The signed-in account (with whether its e-mail is verified), or `user: null`. When the address was
 * verified elsewhere (another browser, the link opened from the phone's mail), the session is refreshed here: the cookie
 * of a browser, or — for a native app's bearer session — a new `token` in the answer, which the app keeps instead.
 */
export async function GET() {
  try {
    const session = await getSession();
    const user = session ? await accountProfile(session) : null;
    const stale = Boolean(session && user && user.emailVerified !== session.emailVerified);
    const bearer = stale && (await sessionTransport()) === "bearer";
    const refreshed = session && user ? { ...session, emailVerified: user.emailVerified } : null;
    const response = NextResponse.json({
      user,
      demoMode: isDemoMode(),
      ...(bearer && refreshed ? { token: signSessionToken(refreshed), expiresIn: SESSION_TTL_SECONDS } : {}),
    });
    if (stale && !bearer && refreshed) setSessionCookie(response, refreshed);
    return response;
  } catch (error) {
    return errorResponse(error, "auth/me");
  }
}
