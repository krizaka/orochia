import crypto from "crypto";

/**
 * Signed-out sessions (krizaka/orochia#127). Sessions are stateless signed tokens: signing out remembers the token's
 * SHA-256 in `revoked_sessions` until the moment it would have expired anyway, and {@link isSessionRevoked} refuses it
 * from then on — whatever copy of it survives (a native cookie jar, a backup, a leaked log).
 */
const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function isSessionRevoked(token: string): Promise<boolean> {
  const { db, revokedSessions } = await import("@orochia/db");
  const { eq } = await import("drizzle-orm");
  const rows = await db.select({ tokenHash: revokedSessions.tokenHash }).from(revokedSessions).where(eq(revokedSessions.tokenHash, hash(token))).limit(1);
  return rows.length > 0;
}

/** Revokes a session token until `expiresAt`, and forgets the revocations whose tokens have expired since. */
export async function revokeSession(token: string, expiresAt: Date): Promise<void> {
  const { db, revokedSessions } = await import("@orochia/db");
  const { lt } = await import("drizzle-orm");
  await db.insert(revokedSessions).values({ tokenHash: hash(token), expiresAt }).onConflictDoNothing();
  await db.delete(revokedSessions).where(lt(revokedSessions.expiresAt, new Date()));
}

/** True when a token issued at `issuedAt` (ms) predates the moment an operator ended the account's sessions. Pure. */
export function issuedBefore(issuedAt: number | undefined, validAfter: Date | null | undefined): boolean {
  if (!validAfter) return false;
  // A token carries its expiry in whole seconds, so its issue time is known to the second: it is refused only when its
  // whole second lies before the revocation (a person who signs in the very second after the operator acted gets in).
  // A token whose issue time is unknown cannot be shown to postdate the revocation.
  return issuedAt === undefined || issuedAt + 1000 <= validAfter.getTime();
}

/** Whether an operator ended this account's sessions after the token was issued (one indexed read of the user). */
export async function sessionsEndedByOperator(userId: string, issuedAt: number | undefined): Promise<boolean> {
  const { db, users } = await import("@orochia/db");
  const { eq } = await import("drizzle-orm");
  const [row] = await db.select({ validAfter: users.sessionsValidAfter }).from(users).where(eq(users.id, userId)).limit(1);
  return issuedBefore(issuedAt, row?.validAfter);
}
