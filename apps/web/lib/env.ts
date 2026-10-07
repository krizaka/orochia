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

export function appUrl(): string {
  return read("NEXT_PUBLIC_APP_URL", "http://localhost:3000").replace(/\/$/, "");
}

export interface BunnyStreamConfig {
  apiKey: string;
  libraryId: number;
  hostname: string;
  tokenAuthKey: string;
  collectionId?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bunnyStreamConfig(): BunnyStreamConfig {
  const libraryId = Number(read("BUNNY_STREAM_LIBRARY_ID", "1"));
  if (!Number.isInteger(libraryId) || libraryId <= 0) {
    throw new ConfigurationError("BUNNY_STREAM_LIBRARY_ID", "must be a positive integer");
  }
  // Optional: the Bunny collection new uploads are filed in.
  const collectionId = process.env.BUNNY_STREAM_COLLECTION_ID?.trim() || undefined;
  if (collectionId && !UUID.test(collectionId)) {
    throw new ConfigurationError("BUNNY_STREAM_COLLECTION_ID", "must be a collection UUID");
  }
  return {
    apiKey: read("BUNNY_STREAM_API_KEY", "development-bunny-api-key"),
    libraryId,
    hostname: read("BUNNY_STREAM_HOSTNAME", "vz-development.b-cdn.net"),
    tokenAuthKey: read("BUNNY_STREAM_TOKEN_AUTH_KEY", "development-token-auth-key"),
    collectionId,
  };
}

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
