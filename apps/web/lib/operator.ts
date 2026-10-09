import crypto from "crypto";
import { headers } from "next/headers";
import { HttpError } from "./http";
import type { SessionUser } from "./auth";

/**
 * The operator console (krizaka/orochia-admin) calls the admin API as a service: `Authorization: Bearer <token>` with
 * OROCHIA_ADMIN_API_TOKEN (32+ characters, shared by the two deployments only). The console has its own single
 * operator account; here its calls act as the platform owner (OROCHIA_OWNER_EMAIL), who must exist and be an ADMIN.
 * Without the variable, no token is accepted. The token opens ADMIN routes only (requireUserWithRole).
 */

const MIN_LENGTH = 32;

function configuredToken(): string | null {
  const token = process.env.OROCHIA_ADMIN_API_TOKEN?.trim();
  return token && token.length >= MIN_LENGTH ? token : null;
}

function same(a: string, b: string): boolean {
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

/** The owner acting for the console, when the request carries the console's token; null when it carries none. */
export async function operatorFromToken(): Promise<SessionUser | null> {
  const header = (await headers()).get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const expected = configuredToken();
  if (!expected || !same(header.slice(7).trim(), expected)) throw new HttpError(401, "Invalid operator token");
  const email = process.env.OROCHIA_OWNER_EMAIL?.trim().toLowerCase();
  if (!email) throw new HttpError(503, "The platform owner is not configured");
  const { db, users } = await import("@orochia/db");
  const { eq } = await import("drizzle-orm");
  const [owner] = await db
    .select({ id: users.id, username: users.username, email: users.email, role: users.role, isAgeVerified: users.isAgeVerified, suspendedAt: users.suspendedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!owner || owner.role !== "ADMIN" || owner.suspendedAt) throw new HttpError(503, "The platform owner account is not an active administrator");
  return { id: owner.id, username: owner.username, email: owner.email, role: "ADMIN", isAgeVerified: owner.isAgeVerified, emailVerified: true };
}
