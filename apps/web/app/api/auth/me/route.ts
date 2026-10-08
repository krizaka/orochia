import { NextResponse } from "next/server";
import { getSession, setSessionCookie } from "@/lib/auth";
import { accountProfile } from "@/lib/queries";
import { isDemoMode } from "@/lib/env";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * The signed-in account (with whether its e-mail is verified), or `user: null`. When the address was
 * verified elsewhere (another browser), the session cookie is refreshed here.
 */
export async function GET() {
  try {
    const session = await getSession();
    const user = session ? await accountProfile(session) : null;
    const response = NextResponse.json({ user, demoMode: isDemoMode() });
    if (session && user && user.emailVerified !== session.emailVerified) {
      setSessionCookie(response, { ...session, emailVerified: user.emailVerified });
    }
    return response;
  } catch (error) {
    return errorResponse(error, "auth/me");
  }
}
