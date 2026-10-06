import crypto from "crypto";
import { cookies } from "next/headers";
import { db, users } from "@orochia/db";
import { eq } from "drizzle-orm";

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: "ADMIN" | "CREATOR" | "MEMBER";
  isAgeVerified: boolean;
}

const SESSION_COOKIE_NAME = "orochia_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "default_orochia_dev_secret_key_change_me_in_prod";

/**
 * Signs user payload into a tamper-proof session token.
 */
export function signSessionToken(payload: SessionUser): string {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Validates and decodes signed session token.
 */
export function verifySessionToken(token: string): SessionUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [data, signature] = parts;

    const expectedSignature = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(data)
      .digest("base64url");

    if (signature !== expectedSignature) {
      return null;
    }

    const json = Buffer.from(data, "base64url").toString("utf-8");
    return JSON.parse(json) as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Retrieves the currently authenticated user in Server Components and Server Actions.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  return session;
}

/**
 * Enforces role authorization (e.g. Creator or Admin). Throws error or returns user.
 */
export async function requireUserWithRole(roles: Array<"ADMIN" | "CREATOR" | "MEMBER">): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED: Authentication required");
  }

  if (!roles.includes(user.role)) {
    throw new Error(`FORBIDDEN: Requires one of [${roles.join(", ")}] roles`);
  }

  return user;
}
