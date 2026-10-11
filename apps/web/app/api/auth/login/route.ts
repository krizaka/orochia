import { db, users, verifyPassword } from "@orochia/db";
import { eq, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertLoginAllowed, clearLoginFailures, recordLoginFailure } from "@/lib/abuse/login-throttle";
import { SESSION_TTL_SECONDS, setSessionCookie, signSessionToken } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const LoginSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(256),
  /** A native app asks for its session token in the answer: it sends it back as `Authorization: Bearer`. */
  client: z.enum(["web", "native"]).default("web"),
});

/** Password login — a session cookie for the browser, a bearer token for a native app. The role comes from the account, never from the request. */
export async function POST(req: NextRequest) {
  try {
    const { identifier, password, client } = LoginSchema.parse(await req.json());
    const key = identifier.toLowerCase();

    // Back-off then a temporary lock-out per identifier, and a ceiling per IP (lib/abuse/login-throttle.ts).
    await assertLoginAllowed(key, clientIp(req.headers) ?? "unknown");

    const [account] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, key), eq(users.username, key)))
      .limit(1);

    if (!account || !verifyPassword(password, account.passwordHash)) {
      await recordLoginFailure(key);
      return jsonError(401, "Invalid credentials");
    }
    await clearLoginFailures(key);
    if (account.suspendedAt) return jsonError(403, "This account is suspended. Contact the platform operator.");

    const session = {
      id: account.id,
      username: account.username,
      email: account.email,
      role: account.role,
      isAgeVerified: account.isAgeVerified,
      emailVerified: Boolean(account.emailVerifiedAt),
    };
    // A native app keeps the token in the device's secure storage; a browser gets it only as an httpOnly cookie.
    if (client === "native") {
      return NextResponse.json({ success: true, emailVerified: session.emailVerified, token: signSessionToken(session), expiresIn: SESSION_TTL_SECONDS });
    }
    const response = NextResponse.json({ success: true, emailVerified: session.emailVerified });
    setSessionCookie(response, session);
    return response;
  } catch (error) {
    return errorResponse(error, "auth/login");
  }
}
