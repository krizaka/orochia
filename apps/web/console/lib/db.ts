import { Pool, type PoolConfig } from "pg";

/**
 * The console's own database (DATABASE_CONSOLE_URL) — never Orochia's: the single operator account, its sessions, and the log
 * of every decision taken here. Orochia's data is reached through its admin API only (lib/orochia.ts).
 * The schema is created on first use (idempotent), so a fresh database needs no migration step.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admin_account (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ip text,
  user_agent text
);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at);
CREATE TABLE IF NOT EXISTS admin_audit (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  target text,
  ok boolean NOT NULL,
  detail text
);
ALTER TABLE admin_audit ADD COLUMN IF NOT EXISTS actor text;
ALTER TABLE admin_audit ADD COLUMN IF NOT EXISTS request_id text;
ALTER TABLE admin_audit ADD COLUMN IF NOT EXISTS outcome text;
CREATE INDEX IF NOT EXISTS admin_audit_at_idx ON admin_audit (at DESC);
`;

/** Managed PostgreSQL signs with its own CA (DATABASE_CA_CERT): verify against it, as Orochia does. */
function config(url: string): PoolConfig {
  const ca = process.env.DATABASE_CA_CERT?.trim();
  if (!ca) return { connectionString: url };
  const u = new URL(url);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) u.searchParams.delete(key);
  return { connectionString: u.toString(), ssl: { ca, rejectUnauthorized: true } };
}

const holder = globalThis as unknown as { __adminPool?: Pool; __adminReady?: Promise<void> };

/** A query that gets no answer for this long is abandoned and its connection destroyed (a peer that vanished sends nothing). */
export const QUERY_TIMEOUT_MS = 30_000;

const UNAVAILABLE_CODES = new Set(["53300", "53400", "57P01", "57P02", "57P03", "08000", "08001", "08003", "08004", "08006", "ECONNREFUSED", "ECONNRESET", "ECONNABORTED", "EPIPE", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);
const LOST_MESSAGE = /timeout exceeded when trying to connect|Connection terminated|Query read timeout|Client has encountered a connection error|Connection ended unexpectedly|terminating connection|server closed the connection/i;

/** True when the error means the database is unreachable or the connection died — not that the query is wrong. */
export function isDatabaseUnavailable(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth++) {
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof code === "string" && UNAVAILABLE_CODES.has(code)) return true;
    if (typeof message === "string" && LOST_MESSAGE.test(message)) return true;
    current = cause;
  }
  return false;
}

/** The statement without the whitespace and SQL comments before it (a linear scan). */
function skipLeadingComments(text: string): string {
  let i = 0;
  for (;;) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (text.startsWith("--", i)) {
      const end = text.indexOf("\n", i);
      i = end === -1 ? text.length : end + 1;
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 2;
    } else return text.slice(i);
  }
}

/** A plain read — safe to replay once when its connection died. Writes, CTEs, locks and side-effect functions never are. */
export function isIdempotentRead(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const statement = skipLeadingComments(text);
  if (!/^(select|show)\b/i.test(statement)) return false;
  return !/\bfor\s+(no\s+key\s+)?(update|share|key\s+share)\b|\b(nextval|setval|pg_notify|pg_advisory\w*)\s*\(|\binto\s+\w/i.test(statement);
}

/** The process-wide pool (one per process, kept on globalThis). */
export function pool(): Pool {
  if (!holder.__adminPool) {
    const url = process.env.DATABASE_CONSOLE_URL?.trim();
    if (!url && process.env.NODE_ENV === "production") throw new Error("DATABASE_CONSOLE_URL is required in production");
    const created = new Pool({
      ...config(url || "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_admin?sslmode=disable"),
      max: 5,
      // The database may restart or fail over under a running console (managed PostgreSQL does): idle connections go
      // back quickly, TCP keep-alive and the query timeout notice a peer that vanished, no connection outlives 30 min.
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      query_timeout: QUERY_TIMEOUT_MS,
      maxLifetimeSeconds: 1_800,
    });
    // An idle connection dropped by the server must not crash the process: the pool discards it and opens another.
    created.on("error", (error) => console.error(`[db] idle connection error: ${error.message}`));
    holder.__adminPool = created;
  }
  return holder.__adminPool;
}

/** A query on the console's database, its schema created first (once per process). */
export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  holder.__adminReady ??= pool()
    .query(SCHEMA)
    .then(() => undefined)
    .catch((error: unknown) => {
      holder.__adminReady = undefined;
      throw error;
    });
  await holder.__adminReady;
  try {
    return (await pool().query<T>(text, params)).rows;
  } catch (error) {
    // A read whose connection died is replayed once on a fresh one; a write never is — it may have been applied.
    if (!isDatabaseUnavailable(error) || !isIdempotentRead(text)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 150));
    return (await pool().query<T>(text, params)).rows;
  }
}

/** Ends the pool (tests, graceful shutdown); the next query opens a new one. */
export async function closeDb(): Promise<void> {
  const current = holder.__adminPool;
  holder.__adminPool = undefined;
  holder.__adminReady = undefined;
  await current?.end();
}

export interface DbBudget {
  pool: { max: number; total: number; idle: number; waiting: number };
  /** Connections open on the console's database, and what its role may open. */
  open: number;
  limit: number;
}

/** The console's pool and the database's connections against the role's budget (a small managed cluster has few). */
export async function dbBudget(): Promise<DbBudget> {
  const p = pool();
  const [row] = await sql<{ open: string; role_limit: number; server_limit: string }>(
    `SELECT (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS open,
            (SELECT rolconnlimit FROM pg_roles WHERE rolname = current_user) AS role_limit,
            current_setting('max_connections') AS server_limit`,
  );
  const roleLimit = Number(row?.role_limit ?? -1);
  const serverLimit = Number(row?.server_limit ?? 0);
  return { pool: { max: p.options.max ?? 10, total: p.totalCount, idle: p.idleCount, waiting: p.waitingCount }, open: Number(row?.open ?? 0), limit: roleLimit > 0 ? Math.min(roleLimit, serverLimit || roleLimit) : serverLimit };
}
