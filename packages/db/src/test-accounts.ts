/**
 * npm run db:test-accounts [-- --reset-password]
 *
 * Injects the two QA accounts of a deployed environment: one fan (MEMBER) and one creator (CREATOR), written the way the
 * app writes them — the same columns as the sign-up route (app/api/auth/register) and the creator opening
 * (app/api/me/become-creator). Sign-up stays closed; nothing here is reachable from the web app.
 *
 * Configured by environment only (passwords are never in the code, never printed):
 *   AUTH_TEST_FAN_EMAIL, AUTH_TEST_FAN_USERNAME, AUTH_TEST_FAN_PASSWORD
 *   AUTH_TEST_CREATOR_EMAIL, AUTH_TEST_CREATOR_USERNAME, AUTH_TEST_CREATOR_PASSWORD
 *   AUTH_TEST_DATE_OF_BIRTH   YYYY-MM-DD, an adult (18+); default 1990-01-01
 *
 * Idempotent: an existing account with the same e-mail and username keeps its password unless --reset-password is given.
 * The creator is marked verified (the 18 U.S.C. § 2257 review an operator does by hand), so its uploads can be tested.
 */
import { eq, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { parseArgs } from "node:util";
import { hashPassword } from "./crypto";
import { loadRootEnv } from "./load-env";
import { profiles, users } from "./schema";

export interface TestAccount {
  role: "MEMBER" | "CREATOR";
  email: string;
  username: string;
  displayName: string;
  password: string;
  dateOfBirth: string;
}

const DEFAULT_DATE_OF_BIRTH = "1990-01-01";
const MINIMUM_AGE = 18;

function isAdult(isoDate: string, today: Date): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const eighteenth = Date.UTC(year + MINIMUM_AGE, month - 1, day);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return false;
  return eighteenth <= today.getTime();
}

/** The two QA accounts described by the environment; throws when one is missing or invalid. */
export function testAccountsFromEnv(env: NodeJS.ProcessEnv = process.env, today: Date = new Date()): TestAccount[] {
  const dateOfBirth = env.AUTH_TEST_DATE_OF_BIRTH?.trim() || DEFAULT_DATE_OF_BIRTH;
  if (!isAdult(dateOfBirth, today)) throw new Error("AUTH_TEST_DATE_OF_BIRTH must be a YYYY-MM-DD date, 18 or older");
  const accounts: TestAccount[] = ([
    { role: "MEMBER", prefix: "AUTH_TEST_FAN", displayName: "QA Fan" },
    { role: "CREATOR", prefix: "AUTH_TEST_CREATOR", displayName: "QA Creator" },
  ] as const).map(({ role, prefix, displayName }) => {
    const email = env[`${prefix}_EMAIL`]?.trim().toLowerCase() ?? "";
    const username = env[`${prefix}_USERNAME`]?.trim().toLowerCase() ?? "";
    const password = env[`${prefix}_PASSWORD`] ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${prefix}_EMAIL is missing or not an e-mail address`);
    if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new Error(`${prefix}_USERNAME: 3–30 letters, digits, underscore`);
    if (password.length < 12) throw new Error(`${prefix}_PASSWORD needs 12+ characters`);
    return { role, email, username, displayName, password, dateOfBirth };
  });
  if (accounts[0].email === accounts[1].email || accounts[0].username === accounts[1].username) {
    throw new Error("The fan and the creator need different e-mails and usernames");
  }
  return accounts;
}

/** Creates the account, or brings an existing one (same e-mail and username) back to an active, verified state. */
export async function ensureTestAccount(
  db: NodePgDatabase<Record<string, unknown>>,
  account: TestAccount,
  options: { resetPassword?: boolean } = {},
): Promise<{ id: string; created: boolean; passwordSet: boolean }> {
  const [existing] = await db
    .select({ id: users.id, email: users.email, username: users.username })
    .from(users)
    .where(or(eq(users.email, account.email), eq(users.username, account.username)))
    .limit(1);
  if (existing && (existing.email !== account.email || existing.username !== account.username)) {
    throw new Error(`Another account already uses this e-mail or username (@${existing.username})`);
  }
  const setPassword = !existing || Boolean(options.resetPassword);
  const active = {
    role: account.role,
    isVerified: true,
    isAgeVerified: true,
    dateOfBirth: account.dateOfBirth,
    suspendedAt: null,
    suspensionReason: null,
    updatedAt: new Date(),
  };
  const id = await db.transaction(async (tx) => {
    const [row] = existing
      ? await tx
          .update(users)
          .set({ ...active, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, ...(setPassword ? { passwordHash: hashPassword(account.password) } : {}) })
          .where(eq(users.id, existing.id))
          .returning({ id: users.id })
      : await tx
          .insert(users)
          .values({ email: account.email, username: account.username, passwordHash: hashPassword(account.password), ...active, emailVerifiedAt: new Date() })
          .returning({ id: users.id });
    await tx
      .insert(profiles)
      .values({ userId: row.id, displayName: account.displayName })
      .onConflictDoUpdate({ target: profiles.userId, set: { displayName: account.displayName, updatedAt: new Date() } });
    return row.id;
  });
  return { id, created: !existing, passwordSet: setPassword };
}

async function main(): Promise<void> {
  loadRootEnv(__dirname);
  const { db } = await import("./client");
  const { values } = parseArgs({ options: { "reset-password": { type: "boolean", default: false } } });
  for (const account of testAccountsFromEnv()) {
    const outcome = await ensureTestAccount(db, account, { resetPassword: values["reset-password"] });
    console.log(`✓ ${account.role} @${account.username} ${outcome.created ? "created" : "up to date"}${outcome.passwordSet ? "" : " (password unchanged)"}`);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      console.error("✗", error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
