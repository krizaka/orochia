import crypto from "crypto";
import { cookies, headers } from "next/headers";
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
  /** The address was confirmed. Until then the account can only sign in and ask for the link again. */
  emailVerified: boolean;
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
    emailVerified: user.emailVerified,
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
      emailVerified: payload.emailVerified === true,
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

/**
 * The signed-in session of the request, verified address or not (sign-in, /auth/me, the resend link): the browser's
 * session cookie, or — for the native apps, which carry no cookie jar of their own — the same signed token sent as
 * `Authorization: Bearer <token>`. A bearer token is never sent by a browser on its own, so it opens no CSRF path.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? bearerToken((await headers()).get("authorization"));
  return token ? verifySessionToken(token) : null;
}

/** The token of an `Authorization: Bearer …` header, if there is one. */
export function bearerToken(authorization: string | null): string | undefined {
  const match = authorization?.match(/^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
  return match?.[1];
}

/**
 * The authenticated user of the current request, if any — an account whose address is not verified
 * yet counts as a visitor everywhere (it can do nothing but sign in and ask for the link again).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.emailVerified ? session : null;
}

/**
 * The authenticated user, or a 401/403 HttpError. On ADMIN-only routes the operator console may present its service
 * token instead of a session (lib/operator.ts). Sessions are stateless tokens, so the account is
 * re-read here: a suspension or a role change takes effect on the very next request, not when the
 * cookie expires.
 */
export async function requireUserWithRole(roles: Role[], options: { allowUnverifiedEmail?: boolean } = {}): Promise<SessionUser> {
  // The operator console's service token (lib/operator.ts) opens administrator routes only.
  if (roles.length === 1 && roles[0] === "ADMIN") {
    const { operatorFromToken } = await import("./operator");
    const operator = await operatorFromToken();
    if (operator) return operator;
  }
  const user = await getSession();
  if (!user) throw new HttpError(401, "Authentication required");
  const { db, users } = await import("@orochia/db");
  const { eq } = await import("drizzle-orm");
  const [account] = await db
    .select({ role: users.role, suspendedAt: users.suspendedAt, emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!account) throw new HttpError(401, "Authentication required");
  if (account.suspendedAt) throw new HttpError(403, "Account suspended");
  // The database decides, not the cookie: verifying in another browser counts at once.
  if (!account.emailVerifiedAt && !options.allowUnverifiedEmail) throw new HttpError(403, "Email not verified");
  // The role is the account's current one, not the one frozen in the cookie.
  if (!roles.includes(account.role)) throw new HttpError(403, "Insufficient role");
  return { ...user, role: account.role, emailVerified: Boolean(account.emailVerifiedAt) };
}
