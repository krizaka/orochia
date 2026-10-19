import crypto from "node:crypto";

import { cookies, headers } from "next/headers";

import { sql } from "./db";

/**
 * The console has exactly one account: the default operator, defined by environment —
 * AUTH_OPERATOR_EMAIL, AUTH_OPERATOR_NAME, AUTH_OPERATOR_PASSWORD (12+ characters). It is written to the console's database on first use and
 * whenever the environment changes it (a new password revokes every open session). Nobody signs up; there is no
 * second account. Sessions are random tokens stored hashed, 8 hours, httpOnly cookie.
 */

export const ADMIN_COOKIE = "orochia_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

export interface AdminIdentity {
  email: string;
  displayName: string;
}

function fromEnv() {
  const email = process.env.AUTH_OPERATOR_EMAIL?.trim().toLowerCase();
  const name = process.env.AUTH_OPERATOR_NAME?.trim();
  const password = process.env.AUTH_OPERATOR_PASSWORD ?? "";
  if (!email || !name || password.length < 12) throw new Error("AUTH_OPERATOR_EMAIL, AUTH_OPERATOR_NAME and AUTH_OPERATOR_PASSWORD (12+ characters) must be set");
  return { email, name, password };
}

function hash(password: string, salt = crypto.randomBytes(16).toString("hex")): string {
  return `scrypt:${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

function verify(password: string, stored: string): boolean {
  const [, salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** The single account, brought in line with the environment (same e-mail, name and password). */
async function account() {
  const env = fromEnv();
  const [row] = await sql<{ email: string; name: string; password_hash: string }>(`SELECT email, name, password_hash FROM admin_account WHERE id = 1`);
  if (row && row.email === env.email && row.name === env.name && verify(env.password, row.password_hash)) return row;
  const passwordChanged = !row || !verify(env.password, row.password_hash) || row.email !== env.email;
  const [saved] = await sql<{ email: string; name: string; password_hash: string }>(
    `INSERT INTO admin_account (id, email, name, password_hash) VALUES (1, $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name,
       password_hash = CASE WHEN $4 THEN EXCLUDED.password_hash ELSE admin_account.password_hash END, updated_at = now()
     RETURNING email, name, password_hash`,
    [env.email, env.name, hash(env.password), passwordChanged],
  );
  if (passwordChanged) await sql(`DELETE FROM admin_sessions`);
  return saved;
}

/** Checks the credentials and opens a session; returns the cookie value, or null. */
export async function signIn(email: string, password: string): Promise<string | null> {
  const row = await account();
  const okEmail = sha256(email.trim().toLowerCase()) === sha256(row.email);
  const okPassword = verify(password, row.password_hash);
  if (!okEmail || !okPassword) return null;
  const token = crypto.randomBytes(32).toString("base64url");
  const h = await headers();
  await sql(`DELETE FROM admin_sessions WHERE expires_at < now()`);
  await sql(`INSERT INTO admin_sessions (token_hash, expires_at, ip, user_agent) VALUES ($1, now() + make_interval(secs => $2), $3, $4)`, [
    sha256(token),
    SESSION_SECONDS,
    h.get("do-connecting-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    h.get("user-agent")?.slice(0, 300) ?? null,
  ]);
  return token;
}

export const sessionCookie = (token: string) => ({
  name: ADMIN_COOKIE,
  value: token,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_SECONDS,
});

export async function signOut(token: string | undefined) {
  if (token) await sql(`DELETE FROM admin_sessions WHERE token_hash = $1`, [sha256(token)]);
}

/** The signed-in operator, or null (no cookie, an unknown or expired session). */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const [session] = await sql(`SELECT 1 FROM admin_sessions WHERE token_hash = $1 AND expires_at > now()`, [sha256(token)]);
    if (!session) return null;
    const row = await account();
    return { email: row.email, displayName: row.name };
  } catch (error) {
    console.error("[admin] session check failed", error);
    return null;
  }
}

/** Records an operator decision in the console's log (never throws). */
/** Who did it (the operator's e-mail) and which calls to Orochia it made (the edge's request ids) ride along with what was done. */
export async function audit(action: string, target: string | null, ok: boolean, detail?: string, who?: { actor?: string | null; requestIds?: string[] }) {
  try {
    await sql(`INSERT INTO admin_audit (action, target, ok, detail, actor, request_id) VALUES ($1, $2, $3, $4, $5, $6)`, [action, target, ok, detail?.slice(0, 1000) ?? null, who?.actor ?? null, who?.requestIds?.length ? who.requestIds.join(",").slice(0, 300) : null]);
  } catch (error) {
    console.error("[admin] audit failed", error);
  }
}

export async function recentAudit(limit = 50) {
  return sql<{ at: Date; action: string; target: string | null; ok: boolean; detail: string | null; actor: string | null; request_id: string | null }>(
    `SELECT at, action, target, ok, detail, actor, request_id FROM admin_audit ORDER BY at DESC LIMIT $1`,
    [limit],
  );
}
