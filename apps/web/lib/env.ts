/**
 * Runtime configuration. Every secret is read lazily (so `next build` needs none of them) and is
 * mandatory in production: a missing value fails the request with a ConfigurationError instead of
 * silently running on a placeholder. Development defaults exist only outside production.
 */

export class ConfigurationError extends Error {
  constructor(name: string, detail = "is required in production") {
    super(`${name} ${detail}`);
    this.name = "ConfigurationError";
  }
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Demo mode: seeded showcase accounts can be switched to from the login page. Never available in
 * production, whatever the variable says.
 */
export function isDemoMode(): boolean {
  return !isProduction() && process.env.OROCHIA_DEMO_MODE === "true";
}

function read(name: string, developmentDefault: string): string {
  const value = process.env[name];
  if (value && value.trim()) return value.trim();
  if (isProduction()) throw new ConfigurationError(name);
  return developmentDefault;
}

export function sessionSecret(): string {
  const secret = read("SESSION_SECRET", "development-only-orochia-session-secret-0123456789");
  if (secret.length < 32) throw new ConfigurationError("SESSION_SECRET", "must be at least 32 characters");
  return secret;
}

/** Key that encrypts payout account details at rest (AES-256-GCM). Mandatory in production; derived locally. */
export function payoutEncryptionKey(): string {
  const key = process.env.PAYOUT_ENCRYPTION_KEY?.trim();
  if (key) {
    if (key.length < 32) throw new ConfigurationError("PAYOUT_ENCRYPTION_KEY", "must be at least 32 characters");
    return key;
  }
  if (isProduction()) throw new ConfigurationError("PAYOUT_ENCRYPTION_KEY");
  return `development-payouts:${sessionSecret()}`;
}

export function appUrl(): string {
  return read("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, "");
}

export interface BunnyStreamConfig {
  apiKey: string;
  libraryId: number;
  hostname: string;
  tokenAuthKey: string;
  collectionId?: string;
  storiesCollectionId?: string;
  draftsCollectionId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bunnyStreamConfig(): BunnyStreamConfig {
  const libraryId = Number(read("BUNNY_STREAM_LIBRARY_ID", "1"));
  if (!Number.isInteger(libraryId) || libraryId <= 0) {
    throw new ConfigurationError("BUNNY_STREAM_LIBRARY_ID", "must be a positive integer");
  }
  // Optional: the Bunny collections new uploads (and story videos) are filed in.
  const collectionId = process.env.BUNNY_STREAM_COLLECTION_ID?.trim() || undefined;
  if (collectionId && !UUID.test(collectionId)) {
    throw new ConfigurationError("BUNNY_STREAM_COLLECTION_ID", "must be a collection UUID");
  }
  const storiesCollectionId = process.env.BUNNY_STREAM_STORIES_COLLECTION_ID?.trim() || undefined;
  if (storiesCollectionId && !UUID.test(storiesCollectionId)) {
    throw new ConfigurationError("BUNNY_STREAM_STORIES_COLLECTION_ID", "must be a collection UUID");
  }
  const draftsCollectionId = process.env.BUNNY_STREAM_DRAFTS_COLLECTION_ID?.trim() || undefined;
  if (draftsCollectionId && !UUID.test(draftsCollectionId)) {
    throw new ConfigurationError("BUNNY_STREAM_DRAFTS_COLLECTION_ID", "must be a collection UUID");
  }
  return {
    apiKey: read("BUNNY_STREAM_API_KEY", "development-bunny-api-key"),
    libraryId,
    hostname: read("BUNNY_STREAM_HOSTNAME", "vz-development.b-cdn.net"),
    tokenAuthKey: read("BUNNY_STREAM_TOKEN_AUTH_KEY", "development-token-auth-key"),
    collectionId,
    storiesCollectionId,
    draftsCollectionId,
  };
}

/** A whole number from the environment within bounds, or its default (these are tuning, not secrets). */
function setting(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new ConfigurationError(name, `must be a whole number from ${min} to ${max}`);
  return value;
}

/** Editor drafts: how long one is kept (DRAFT_RETENTION_DAYS, 30) and how many an account may keep (DRAFTS_MAX_PER_USER, 20). */
export function draftsConfig() {
  return { retentionDays: setting("DRAFT_RETENTION_DAYS", 30, 1, 365), maxPerUser: setting("DRAFTS_MAX_PER_USER", 20, 1, 200) };
}

/**
 * Before anything that sends video to Bunny (uploads, video stories, drafts): outside production, a library that is not
 * configured is said plainly — what to set and where it is explained — instead of failing at Bunny with placeholders.
 */
export function requireBunnyStream(): BunnyStreamConfig {
  if (!isProduction() && !process.env.BUNNY_STREAM_API_KEY?.trim()) {
    throw new ConfigurationError(
      "BUNNY_STREAM_API_KEY",
      "is not set: uploads, video stories and drafts need a Bunny Stream library (docs/DEVELOPMENT.md, “Video features locally”)",
    );
  }
  return bunnyStreamConfig();
}

/** The Stream library's Read-Only API key: Bunny signs every webhook with it (signature v1). */
export function bunnyWebhookSecret(): string {
  return read("BUNNY_WEBHOOK_SECRET", "");
}

/** Bearer token protecting /api/metrics; mandatory in production. */
export function metricsToken(): string | null {
  const token = process.env.METRICS_AUTH_TOKEN;
  if (token && token.trim()) return token.trim();
  if (isProduction()) throw new ConfigurationError("METRICS_AUTH_TOKEN");
  return null;
}

/** Signed stream URLs expire after this many seconds (AGENTS.md §2.A). */
export const STREAM_TOKEN_TTL_SECONDS = 300;

export interface RealtimeConfig {
  kind: "memory" | "postgres" | "redis";
  redisUrl?: string;
  prefix: string;
  /** A stream ends after this long and the client reconnects (seconds, 0: never). */
  streamMaxSeconds: number;
}

/**
 * The realtime bus (`REALTIME_BUS`): `postgres` (default — LISTEN/NOTIFY, no extra service), `redis` (Redis / Valkey
 * at `REDIS_URL`, for several instances and many streams) or `memory` (one process: tests). Fail-closed: `redis`
 * without a URL is a configuration error, never a silent fallback.
 */
export function realtimeConfig(env: Record<string, string | undefined> = process.env): RealtimeConfig {
  const kind = (env.REALTIME_BUS?.trim().toLowerCase() || "postgres") as RealtimeConfig["kind"];
  if (kind !== "memory" && kind !== "postgres" && kind !== "redis") throw new ConfigurationError("REALTIME_BUS", "must be memory, postgres or redis");
  const redisUrl = env.REDIS_URL?.trim() || undefined;
  if (kind === "redis" && !redisUrl) throw new ConfigurationError("REDIS_URL", "is required when REALTIME_BUS=redis");
  const max = Number(env.REALTIME_STREAM_MAX_SECONDS ?? 300);
  return {
    kind,
    redisUrl,
    prefix: env.REALTIME_PREFIX?.trim() || "orochia:rt:",
    streamMaxSeconds: Number.isFinite(max) && max >= 0 ? max : 300,
  };
}
