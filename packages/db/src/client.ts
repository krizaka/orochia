import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { connectionConfig } from "./connection";
import * as schema from "./schema";

const DEV_DATABASE_URL =
  "postgresql://orochia_user:orochia_secret@localhost:5432/orochia_db?sslmode=disable";

/**
 * Connections per process when DATABASE_MAX_CONNECTIONS is not set. Small on purpose: a managed or App Platform
 * PostgreSQL may accept ~22 connections in all, shared by every instance, the rolling deploy's second instance, the
 * LISTEN connection of each instance and the migrate job. Raise it only with a database (or a pooler) that has room.
 */
export const DEFAULT_POOL_SIZE = 5;

/** Above this, a typo (500) would exhaust any database: the value is capped and a warning says so. */
const MAX_POOL_SIZE = 50;

/** DATABASE_URL is mandatory in production; the local default exists for development only. */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url && url.trim()) return url.trim();
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  return DEV_DATABASE_URL;
}

/** DATABASE_MAX_CONNECTIONS as a positive integer (default 5, at most 50). */
export function poolSize(value: string | undefined = process.env.DATABASE_MAX_CONNECTIONS): number {
  const raw = value?.trim();
  if (!raw) return DEFAULT_POOL_SIZE;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.warn(`[db] DATABASE_MAX_CONNECTIONS="${raw}" is not a positive integer: using ${DEFAULT_POOL_SIZE}`);
    return DEFAULT_POOL_SIZE;
  }
  if (parsed > MAX_POOL_SIZE) {
    console.warn(`[db] DATABASE_MAX_CONNECTIONS=${parsed} is capped at ${MAX_POOL_SIZE}`);
    return MAX_POOL_SIZE;
  }
  return parsed;
}

/**
 * PostgreSQL error codes and network errors that mean "the database is not taking connections" rather than "this
 * query is wrong": too many connections (53300), starting up / shutting down (57P01-57P03), refused, unreachable,
 * timed out.
 */
const UNAVAILABLE_CODES = new Set(["53300", "53400", "57P01", "57P02", "57P03", "08000", "08001", "08003", "08004", "08006", "ECONNREFUSED", "ECONNRESET", "ECONNABORTED", "EPIPE", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH"]);

/** Messages node-postgres gives a connection that died (or went silent) without a code. */
const LOST_MESSAGE = /timeout exceeded when trying to connect|Connection terminated|Query read timeout|Client has encountered a connection error|Connection ended unexpectedly|terminating connection|server closed the connection/i;

/** True when the error (or its cause — Drizzle wraps the driver's error) means the database is unavailable. */
export function isDatabaseUnavailable(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 5; depth++) {
    const { code, message, cause } = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (typeof code === "string" && UNAVAILABLE_CODES.has(code)) return true;
    if (typeof message === "string" && LOST_MESSAGE.test(message)) return true;
    current = cause;
  }
  return false;
}

interface DbHolder {
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  /** How many pools this process created — 1 for its whole life (asserted by client.test.ts). */
  created: number;
  unavailable: { lastLoggedAt: number; suppressed: number };
}

/**
 * One pool per process, kept on globalThis. Next.js loads this module in several module graphs (pages, route
 * handlers, instrumentation — each with its own copy of module-level variables): measured on a production build,
 * three pools of DATABASE_MAX_CONNECTIONS each, which exhausted the dev database (53300) on 2026-10-12.
 */
const holder = globalThis as unknown as { __orochiaDb?: DbHolder; __orochiaDbCreated?: number };

const UNAVAILABLE_LOG_EVERY_MS = 30_000;

/** A query that gets no answer for this long is abandoned and its connection destroyed (the longest legitimate query is far below). */
export const QUERY_TIMEOUT_MS = 30_000;
/** The health check must answer fast: a load balancer waits for it. */
export const HEALTH_TIMEOUT_MS = 3_000;
/** A pooled connection is replaced after this long, so a failover or a maintenance never finds an old one. */
export const MAX_CONNECTION_LIFETIME_SECONDS = 1_800;
/** Pause before the single retry of a read: the pool opens a fresh connection meanwhile. */
const READ_RETRY_DELAY_MS = 150;

/**
 * True for a statement that only reads and may therefore be replayed when its connection died under it: a plain
 * SELECT / SHOW / EXPLAIN, without row locks and without the functions that have effects (sequences, notifications,
 * advisory locks). Everything else — writes, DO blocks, CTEs (which may modify), transactions — is never retried.
 */
export function isIdempotentRead(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const sqlText = text.replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, "");
  if (!/^(select|show|explain\s+(?!analyze))\b/i.test(sqlText)) return false;
  return !/\bfor\s+(no\s+key\s+)?(update|share|key\s+share)\b|\b(nextval|setval|pg_notify|pg_advisory\w*|pg_terminate_backend|pg_cancel_backend)\s*\(|\binto\s+\w/i.test(sqlText);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** One clear line when the database refuses connections, at most every 30 s, with how many were not logged. */
function reportUnavailable(state: DbHolder["unavailable"], error: unknown, max: number): void {
  const now = Date.now();
  if (now - state.lastLoggedAt < UNAVAILABLE_LOG_EVERY_MS) {
    state.suppressed += 1;
    return;
  }
  const { code, message } = error as { code?: string; message?: string };
  const more = state.suppressed ? ` (${state.suppressed} more since the last report)` : "";
  console.error(`[db] database unavailable: ${code ?? "error"} ${message ?? ""}${more} — this instance holds at most ${max} connections (DATABASE_MAX_CONNECTIONS)`);
  state.lastLoggedAt = now;
  state.suppressed = 0;
}

function createHolder(): DbHolder {
  const max = poolSize();
  const pool = new Pool({
    ...connectionConfig(databaseUrl()),
    application_name: "orochia-web",
    max,
    // Idle connections go back to the database quickly: a quiet instance holds none, the next one deploying has room.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    // A connection that silently went away (failover, a firewall dropping idle flows) never errors by itself: TCP
    // keep-alive makes the kernel notice, the query timeout bounds a query that waits for a dead peer (the client is
    // then destroyed, not returned to the pool), and no connection outlives a managed-database maintenance window.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    query_timeout: QUERY_TIMEOUT_MS,
    maxLifetimeSeconds: MAX_CONNECTION_LIFETIME_SECONDS,
    // A script that only imports the client (seed, owner CLI) exits when its work is done.
    allowExitOnIdle: true,
  });
  const created = (holder.__orochiaDbCreated ?? 0) + 1;
  holder.__orochiaDbCreated = created;
  const state: DbHolder = { pool, db: drizzle(pool, { schema }), created, unavailable: { lastLoggedAt: 0, suppressed: 0 } };

  // An idle connection dropped by the server (restart, failover) must not crash the process: the pool replaces it.
  pool.on("error", (error) => {
    if (isDatabaseUnavailable(error)) reportUnavailable(state.unavailable, error, max);
    else console.error(`[db] idle connection error: ${error.message}`);
  });

  // Connection failures are reported once in a while, in one line; the query still fails (the caller decides).
  const connect = pool.connect.bind(pool) as (callback?: (...args: unknown[]) => void) => unknown;
  (pool as unknown as { connect: typeof connect }).connect = (callback) => {
    if (callback) {
      return connect((error: unknown, ...rest: unknown[]) => {
        if (error && isDatabaseUnavailable(error)) reportUnavailable(state.unavailable, error, max);
        callback(error, ...rest);
      });
    }
    return (connect() as Promise<unknown>).catch((error: unknown) => {
      if (isDatabaseUnavailable(error)) reportUnavailable(state.unavailable, error, max);
      throw error;
    });
  };

  // A read whose connection died under it (reset, failover, silence) is replayed once on a fresh connection; a write
  // never is — it may have been applied. Transactions use a checked-out client and are not affected.
  const query = pool.query.bind(pool) as (...args: unknown[]) => unknown;
  (pool as unknown as { query: typeof query }).query = (...args: unknown[]) => {
    const first = args[0] as string | { text?: string } | undefined;
    const text = typeof first === "string" ? first : first?.text;
    const hasCallback = typeof args[args.length - 1] === "function";
    if (hasCallback || !isIdempotentRead(text)) return query(...args);
    return (query(...args) as Promise<unknown>).catch(async (error: unknown) => {
      if (!isDatabaseUnavailable(error)) throw error;
      await sleep(READ_RETRY_DELAY_MS);
      return query(...args);
    });
  };
  return state;
}

function current(): DbHolder {
  if (!holder.__orochiaDb) holder.__orochiaDb = createHolder();
  return holder.__orochiaDb;
}

/** The process-wide pool — for the few operations that need raw SQL (platform status, backups, factory reset). */
export function getPool(): Pool {
  return current().pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  return current().db;
}

/** How many pools this process created (1 once connected; read by tests and diagnostics). */
export function poolsCreated(): number {
  return holder.__orochiaDbCreated ?? 0;
}

/** Ends the pool (tests, graceful shutdown); the next query opens a new one. */
export async function closeDb(): Promise<void> {
  const state = holder.__orochiaDb;
  holder.__orochiaDb = undefined;
  await state?.pool.end();
}

/**
 * Lazily connected client: importing this module never opens a connection (so `next build`
 * and unit tests run without a database); the first query does.
 */
export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, property, receiver) {
    const instance = getDb();
    const value = Reflect.get(instance as object, property, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export async function checkDbHealth(): Promise<boolean> {
  try {
    // On the pool itself, with its own short timeout: the answer reflects "can a query be served now", and a pool
    // full of dead connections cannot hold the health check hostage.
    let timer: NodeJS.Timeout | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error("Query read timeout (health check)"), { code: "ETIMEDOUT" })), HEALTH_TIMEOUT_MS);
    });
    const ping = getPool().query("SELECT 1");
    ping.catch(() => undefined); // the loser of the race must not become an unhandled rejection
    try {
      await Promise.race([ping, deadline]);
    } finally {
      clearTimeout(timer);
    }
    return true;
  } catch (error) {
    if (isDatabaseUnavailable(error)) console.error(`[db] health check: database unavailable (${(error as { code?: string }).code ?? "error"})`);
    else console.error("Database health check failed:", error);
    return false;
  }
}
