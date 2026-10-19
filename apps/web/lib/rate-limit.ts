import { db, rateLimitBuckets } from "@orochia/db";
import { lt, sql } from "drizzle-orm";

import { automationScore } from "./abuse/automation";
import { clientIp } from "./client-ip";
import { HttpError } from "./http";

/**
 * Fixed-window rate limits for abuse prevention (sign-in, sign-up, uploads, payments, messages, bids, search…).
 *
 * The counters live in a {@link RateLimitStore}, chosen by `ABUSE_RATE_LIMIT_STORE`:
 * - `memory` (default): per instance — counters reset on restart and are NOT shared, so with N instances every limit
 *   is N times looser. Fine for one instance only.
 * - `postgres`: one upsert per check on `rate_limit_buckets`, shared by every instance (the database the app already
 *   has). Use it as soon as there is more than one instance; a Redis / Valkey store (issue #40) implements the same
 *   interface when the load calls for it.
 * A store that fails lets the request through (logged): a limiter outage must not take the site down.
 */
export interface RateLimitHit {
  count: number;
  /** Epoch milliseconds the window ends at. */
  resetAt: number;
}

export interface RateLimitStore {
  readonly name: string;
  /** Counts one hit on `key` in a window of `windowSeconds` (a new window starts when the last one ended). */
  hit(key: string, windowSeconds: number, now?: number): Promise<RateLimitHit>;
  /** The current window of `key`, without counting (null when none is open). */
  peek(key: string, now?: number): Promise<RateLimitHit | null>;
  /** Opens (or replaces) a window holding `count` until `seconds` from now — a lock-out. */
  set(key: string, count: number, seconds: number, now?: number): Promise<void>;
  /** Forgets `key` (a successful sign-in clears its failures). */
  reset(key: string): Promise<void>;
}

const MAX_KEYS = 10_000;
/** When the table is full of live windows, this share of it is dropped — the cheapest to forget (orochia#254). */
const EVICT_SHARE = 0.1;

export function memoryStore(): RateLimitStore {
  const windows = new Map<string, RateLimitHit>();
  const evict = (now: number) => {
    if (windows.size < MAX_KEYS) return;
    for (const [key, value] of windows) if (value.resetAt <= now) windows.delete(key);
    if (windows.size < MAX_KEYS) return;
    // Still full of live windows (a flood of keys, or a very busy day). Never wipe everyone's counters — that would
    // hand every throttled account and address a fresh start: drop the cheapest to forget, the fewest hits first, the
    // oldest first among equals. A lock-out or a heavy counter outlives a flood of one-hit keys.
    const cheapest = [...windows].sort(([, a], [, b]) => a.count - b.count || a.resetAt - b.resetAt).slice(0, Math.ceil(MAX_KEYS * EVICT_SHARE));
    for (const [key] of cheapest) windows.delete(key);
  };
  return {
    name: "memory",
    async hit(key, windowSeconds, now = Date.now()) {
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= now) {
        evict(now);
        entry = { count: 0, resetAt: now + windowSeconds * 1000 };
        windows.set(key, entry);
      }
      entry.count += 1;
      return { ...entry };
    },
    async peek(key, now = Date.now()) {
      const entry = windows.get(key);
      return entry && entry.resetAt > now ? { ...entry } : null;
    },
    async set(key, count, seconds, now = Date.now()) {
      evict(now);
      windows.set(key, { count, resetAt: now + seconds * 1000 });
    },
    async reset(key) {
      windows.delete(key);
    },
  };
}

/** Shared by every instance: `rate_limit_buckets`, one atomic upsert per hit. */
export function postgresStore(): RateLimitStore {
  return {
    name: "postgres",
    async hit(key, windowSeconds, now = Date.now()) {
      const at = new Date(now);
      const resetAt = new Date(now + windowSeconds * 1000);
      const result = await db.execute<{ count: number; reset_at: Date | string }>(sql`
        insert into rate_limit_buckets (key, count, reset_at) values (${key}, 1, ${resetAt})
        on conflict (key) do update set
          count = case when rate_limit_buckets.reset_at <= ${at} then 1 else rate_limit_buckets.count + 1 end,
          reset_at = case when rate_limit_buckets.reset_at <= ${at} then excluded.reset_at else rate_limit_buckets.reset_at end
        returning count, reset_at`);
      const row = result.rows[0];
      return { count: Number(row.count), resetAt: new Date(row.reset_at).getTime() };
    },
    async peek(key, now = Date.now()) {
      const result = await db.execute<{ count: number; reset_at: Date | string }>(
        sql`select count, reset_at from rate_limit_buckets where key = ${key} and reset_at > ${new Date(now)}`,
      );
      const row = result.rows[0];
      return row ? { count: Number(row.count), resetAt: new Date(row.reset_at).getTime() } : null;
    },
    async set(key, count, seconds, now = Date.now()) {
      const resetAt = new Date(now + seconds * 1000);
      await db
        .insert(rateLimitBuckets)
        .values({ key, count, resetAt })
        .onConflictDoUpdate({ target: rateLimitBuckets.key, set: { count, resetAt } });
    },
    async reset(key) {
      await db.execute(sql`delete from rate_limit_buckets where key = ${key}`);
    },
  };
}

let store: RateLimitStore | null = null;

/** The configured store (ABUSE_RATE_LIMIT_STORE=memory|postgres), created once per instance. */
export function rateLimitStore(env: Record<string, string | undefined> = process.env): RateLimitStore {
  if (store) return store;
  const kind = env.ABUSE_RATE_LIMIT_STORE?.trim().toLowerCase() || "memory";
  if (kind !== "memory" && kind !== "postgres") throw new Error(`ABUSE_RATE_LIMIT_STORE must be "memory" or "postgres", not "${kind}"`);
  store = kind === "postgres" ? postgresStore() : memoryStore();
  return store;
}

/** Tests: use this store (null: back to the configured one). */
export function useRateLimitStore(next: RateLimitStore | null) {
  store = next;
}

/** Removes the windows that ended (postgres store; the background loop calls it). */
export async function sweepRateLimits(now = new Date()): Promise<number> {
  if (rateLimitStore().name !== "postgres") return 0;
  const rows = await db.delete(rateLimitBuckets).where(lt(rateLimitBuckets.resetAt, now)).returning({ key: rateLimitBuckets.key });
  return rows.length;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  /** Seconds until the window ends (the `Retry-After` of a refusal). */
  retryAfterSeconds: number;
}

/** Counts one request for `identifier`: `limit` per `windowSeconds`. Never throws (a failing store lets it through). */
export async function checkRateLimit(identifier: string, limit = 20, windowSeconds = 60): Promise<RateLimitResult> {
  const now = Date.now();
  try {
    const { count, resetAt } = await rateLimitStore().hit(identifier.slice(0, 200), windowSeconds, now);
    return { success: count <= limit, remaining: Math.max(0, limit - count), retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
  } catch (error) {
    console.error(`rate-limit: store failed for ${identifier.split(":")[0]} — request allowed`, error);
    return { success: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** A refusal for too many requests: 429, a stable `code`, and `Retry-After` (seconds). */
export class RateLimitError extends HttpError {
  constructor(message: string, retryAfterSeconds: number, code = "RATE_LIMITED") {
    super(429, message, { code, retryAfterSeconds }, { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) });
    this.name = "RateLimitError";
  }
}

/** Throws a {@link RateLimitError} (answered by `errorResponse`) when `identifier` went over `limit` per `windowSeconds`. */
export async function enforceRateLimit(identifier: string, limit: number, windowSeconds: number, message = "Too many requests. Try again later.", code?: string) {
  const result = await checkRateLimit(identifier, limit, windowSeconds);
  if (!result.success) throw new RateLimitError(message, result.retryAfterSeconds, code);
  return result;
}

export interface ActionLimits {
  /** [limit, window seconds] per signed-in account. */
  perUser?: [number, number];
  /** [limit, window seconds] per IP address — what stops one machine with many accounts (or none). */
  perIp?: [number, number];
}

/**
 * Limits a sensitive action per account AND per IP (an attacker rotating accounts still shares an address; one rotating
 * addresses still has one account). Automated-looking clients (lib/abuse/automation.ts) get a quarter of the IP limit.
 */
export async function limitAction(
  action: string,
  req: { headers: Headers },
  userId: string | null | undefined,
  limits: ActionLimits,
  message?: string,
) {
  const strict = automationScore(req.headers) > 0;
  if (limits.perIp) {
    const [limit, window] = limits.perIp;
    await enforceRateLimit(`${action}:ip:${clientIp(req.headers) ?? "unknown"}`, strict ? Math.max(1, Math.floor(limit / 4)) : limit, window, message);
  }
  if (limits.perUser && userId) {
    const [limit, window] = limits.perUser;
    await enforceRateLimit(`${action}:user:${userId}`, limit, window, message);
  }
}
