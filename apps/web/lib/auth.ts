import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { HttpError } from "./http";
import { isProduction, sessionSecret } from "./env";

export type Role = "ADMIN" | "CREATOR" | "MEMBER";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  isAgeVerified: boolean;
}

interface SessionPayload extends SessionUser {
  /** Expiry, seconds since epoch. */
  exp: number;
}

export const SESSION_COOKIE_NAME = "orochia_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function sign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

/** Signs a session that expires after {@link SESSION_TTL_SECONDS}. */
export function signSessionToken(
  user: SessionUser,
  secret: string = sessionSecret(),
  now: number = Date.now(),
): string {
  const payload: SessionPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isAgeVerified: user.isAgeVerified,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

/** The session a token carries, or null when it is malformed, forged or expired. */
export function verifySessionToken(
  token: string,
  secret: string = sessionSecret(),
  now: number = Date.now(),
): SessionUser | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expected = Buffer.from(sign(data, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= now) return null;
    if (!["ADMIN", "CREATOR", "MEMBER"].includes(payload.role)) return null;
    return {
      id: payload.id,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      isAgeVerified: payload.isAgeVerified === true,
    };
  } catch {
    return null;
  }
}

/** Sets the session cookie on a response (httpOnly, SameSite=Lax, Secure in production). */
export function setSessionCookie(response: NextResponse, user: SessionUser): void {
  response.cookies.set(SESSION_COOKIE_NAME, signSessionToken(user), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** The authenticated user of the current request, if any. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : null;
}

/**
 * The authenticated user, or a 401/403 HttpError. Sessions are stateless tokens, so the account is
 * re-read here: a suspension or a role change takes effect on the very next request, not when the
 * cookie expires.
 */
export async function requireUserWithRole(roles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Authentication required");
  const { db, users } = await import("@orochia/db");
  const { eq } = await import("drizzle-orm");
  const [account] = await db
    .select({ role: users.role, suspendedAt: users.suspendedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!account) throw new HttpError(401, "Authentication required");
  if (account.suspendedAt) throw new HttpError(403, "Account suspended");
  // The role is the account's current one, not the one frozen in the cookie.
  if (!roles.includes(account.role)) throw new HttpError(403, "Insufficient role");
  return { ...user, role: account.role };
}
