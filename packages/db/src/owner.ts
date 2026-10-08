/**
 * The platform owner's account — the default user, configured by environment:
 *
 *   OROCHIA_OWNER_EMAIL, OROCHIA_OWNER_USERNAME, OROCHIA_OWNER_NAME   who it is
 *   OROCHIA_OWNER_PASSWORD                                            its password at creation (10+ characters)
 *
 * `ensureOwner` creates the account, or brings it back to an active state: operator (ADMIN),
 * age-verified, 2257-verified, not suspended. It never deletes anything and keeps an existing
 * password (unless asked to reset it), so it is safe on every start. The release job (migrate.cjs)
 * runs it after the migrations whenever OROCHIA_OWNER_EMAIL is set.
 */
import { eq, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { hashPassword } from "./crypto";
import { profiles, users } from "./schema";

export interface OwnerConfig {
  email: string;
  username: string;
  name: string;
  password?: string;
  role?: "ADMIN" | "CREATOR" | "MEMBER";
}

/**
 * The default test user described by the environment (OROCHIA_DEFAULT_USER_* or OROCHIA_OWNER_*).
 * Note: this is a standard user used for testing and validating the app, not a super-admin backdoor.
 */
export function ownerFromEnv(env: NodeJS.ProcessEnv = process.env): OwnerConfig | null {
  const email = (env.OROCHIA_DEFAULT_USER_EMAIL ?? env.OROCHIA_OWNER_EMAIL)?.trim();
  if (!email) return null;
  const rawRole = (env.OROCHIA_DEFAULT_USER_ROLE ?? env.OROCHIA_OWNER_ROLE)?.trim().toUpperCase();
  const role = rawRole === "MEMBER" || rawRole === "CREATOR" || rawRole === "ADMIN" ? rawRole : "ADMIN";
  return {
    email,
    username: (env.OROCHIA_DEFAULT_USER_USERNAME ?? env.OROCHIA_OWNER_USERNAME)?.trim() ?? "",
    name: (env.OROCHIA_DEFAULT_USER_NAME ?? env.OROCHIA_OWNER_NAME)?.trim() ?? "",
    password: (env.OROCHIA_DEFAULT_USER_PASSWORD ?? env.OROCHIA_OWNER_PASSWORD) || undefined,
    role,
  };
}

export function validateOwner(config: OwnerConfig): OwnerConfig {
  const email = config.email.trim().toLowerCase();
  const username = config.username.trim().toLowerCase();
  const name = config.name.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Default user email is not an e-mail address");
  if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new Error("Default user username: 3–30 letters, digits, underscore");
  if (!name || name.length > 100) throw new Error("Default user name is required (100 characters at most)");
  if (config.password !== undefined && config.password.length < 10) throw new Error("Default user password needs 10+ characters");
  return { email, username, name, password: config.password, role: config.role ?? "ADMIN" };
}

export type OwnerOutcome = { id: string; created: boolean; passwordSet: boolean };

/**
 * Creates or reactivates the owner. Creating needs a password; an existing account keeps its own
 * unless `resetPassword` is set.
 */
export async function ensureOwner(
  db: NodePgDatabase<Record<string, unknown>>,
  input: OwnerConfig,
  options: { resetPassword?: boolean } = {},
): Promise<OwnerOutcome> {
  const owner = validateOwner(input);
  const [existing] = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, owner.email), eq(users.username, owner.username)))
    .limit(1);
  if (existing && (existing.email !== owner.email || existing.username !== owner.username)) {
    const field = existing.email === owner.email ? "e-mail" : "username";
    throw new Error(`Another account already uses this ${field} (@${existing.username} / ${existing.email})`);
  }
  const setPassword = !existing || Boolean(options.resetPassword);
  if (setPassword && !owner.password) throw new Error("OROCHIA_OWNER_PASSWORD is required to create the owner account");

  const active = { role: owner.role ?? "ADMIN", isVerified: true, isAgeVerified: true, suspendedAt: null, suspensionReason: null, updatedAt: new Date() };
  // The operator configures this address; it is verified by definition (an existing date is kept).
  const verified = { emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` };
  const id = await db.transaction(async (tx) => {
    const [row] = existing
      ? await tx
          .update(users)
          .set({ ...active, ...verified, ...(setPassword ? { passwordHash: hashPassword(owner.password!) } : {}) })
          .where(eq(users.id, existing.id))
          .returning({ id: users.id })
      : await tx
          .insert(users)
          .values({ email: owner.email, username: owner.username, passwordHash: hashPassword(owner.password!), ...active, emailVerifiedAt: new Date() })
          .returning({ id: users.id });
    await tx
      .insert(profiles)
      .values({ userId: row.id, displayName: owner.name })
      .onConflictDoUpdate({ target: profiles.userId, set: { displayName: owner.name, updatedAt: new Date() } });
    return row.id;
  });
  return { id, created: !existing, passwordSet: setPassword };
}
