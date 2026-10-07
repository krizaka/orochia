/**
 * Creates — or brings back to an active state — the platform owner's account: an operator (ADMIN),
 * age-verified, 2257-verified, not suspended. Safe on any database, production included: it never
 * deletes anything and keeps an existing password unless --reset-password is given.
 *
 *   npm run db:owner -- --email you@example.com --username you --name "Your Name" [--reset-password]
 *
 * The password is OROCHIA_OWNER_PASSWORD when set (10+ characters), otherwise generated and printed
 * once. Points at DATABASE_URL (with DATABASE_CA_CERT for a managed cluster).
 */
import crypto from "node:crypto";
import { parseArgs } from "node:util";
import { eq, or } from "drizzle-orm";
import { db } from "./client";
import { hashPassword } from "./crypto";
import { profiles, users } from "./schema";
import { loadRootEnv } from "./load-env";

loadRootEnv(__dirname);

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      username: { type: "string" },
      name: { type: "string" },
      "reset-password": { type: "boolean", default: false },
    },
  });
  const email = values.email?.trim().toLowerCase();
  const username = values.username?.trim().toLowerCase();
  const displayName = values.name?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("--email is required");
  if (!username || !/^[a-z0-9_]{3,30}$/.test(username)) throw new Error("--username: 3–30 letters, digits, underscore");
  if (!displayName) throw new Error("--name is required");

  const given = process.env.OROCHIA_OWNER_PASSWORD;
  if (given !== undefined && given.length < 10) throw new Error("OROCHIA_OWNER_PASSWORD needs 10+ characters");
  const password = given ?? crypto.randomBytes(18).toString("base64url");

  const [existing] = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .limit(1);
  if (existing && (existing.email !== email || existing.username !== username)) {
    throw new Error(`Another account already uses this ${existing.email === email ? "email" : "username"} (${existing.username} / ${existing.email})`);
  }

  const active = { role: "ADMIN" as const, isVerified: true, isAgeVerified: true, suspendedAt: null, suspensionReason: null, updatedAt: new Date() };
  const setPassword = !existing || values["reset-password"];
  const id = await db.transaction(async (tx) => {
    const [row] = existing
      ? await tx
          .update(users)
          .set({ ...active, ...(setPassword ? { passwordHash: hashPassword(password) } : {}) })
          .where(eq(users.id, existing.id))
          .returning({ id: users.id })
      : await tx.insert(users).values({ email, username, passwordHash: hashPassword(password), ...active }).returning({ id: users.id });
    await tx
      .insert(profiles)
      .values({ userId: row.id, displayName })
      .onConflictDoUpdate({ target: profiles.userId, set: { displayName, updatedAt: new Date() } });
    return row.id;
  });

  console.log(`✓ Owner account ${existing ? "activated" : "created"}: ${displayName} <${email}> @${username} (ADMIN, verified) — ${id}`);
  if (setPassword && given === undefined) console.log(`  Password (shown once, change it after signing in): ${password}`);
  else if (!setPassword) console.log("  Password unchanged (pass --reset-password to set a new one).");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("✗", error instanceof Error ? error.message : error);
    process.exit(1);
  });

