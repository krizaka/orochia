/**
 * Runtime configuration — the one environment module of the web app.
 *
 * `ENV_VARS` declares every variable the app, its packages and its scripts read: its bounded context, what it does,
 * whether production needs it, whether it is a secret, and a zod schema for its value. Names follow the Krizaka
 * convention (krizaka/.github#46): `<CONTEXT>_<THING>` — never a product or a vendor; a vendor is a value
 * (`MEDIA_STORAGE_PROVIDER=bunny`, `MAIL_PROVIDER=resend`). `NEXT_PUBLIC_` only where the browser needs the value.
 * docs/DEPLOYMENT.md's variable table is generated from this list (`npm run docs:generate`); env.test.ts fails when
 * code reads a variable that is not declared here.
 *
 * Every secret is read lazily (so `next build` needs none of them) and is mandatory in production: a missing value
 * fails the request with a ConfigurationError instead of silently running on a placeholder, and `assertEnv()` refuses
 * to start a production server whose environment is incomplete or malformed. Development defaults exist only outside
 * production.
 */

import { z } from "zod";

export class ConfigurationError extends Error {
  constructor(name: string, detail = "is required in production") {
    super(`${name} ${detail}`);
    this.name = "ConfigurationError";
  }
}

/** The bounded contexts a variable belongs to, in the order the documentation lists them. */
export const ENV_CONTEXTS = {
  APP: "Application — public URL, environment, build",
  DATABASE: "Database — PostgreSQL",
  AUTH: "Authentication — sessions, owner account, sign-in providers",
  MEDIA: "Media — video streaming, storage, CDN, editor drafts",
  MAIL: "E-mail — provider, sender, templates",
  PUSH: "Mobile push",
  PAYMENTS: "Payments — gateways, platform fee, payouts, credits",
  REALTIME: "Realtime — chat, presence, notifications, auctions",
  ABUSE: "Abuse defences — rate limits, bot challenge, sign-up rules, storage quotas",
  OBSERVABILITY: "Observability — metrics",
  AI: "AI — the Orazaka engine the Explorer calls (embeddings), never a model provider",
  OPERATOR: "Operator console — the admin API",
} as const;
export type EnvContext = keyof typeof ENV_CONTEXTS;

/** required: production refuses to start without it · recommended: production works, degraded · optional. */
export type EnvNeed = "required" | "recommended" | "optional";

export interface EnvVar {
  name: string;
  context: EnvContext;
  need: EnvNeed;
  /** A credential: SECRET on App Platform, never logged, never in git. */
  secret?: boolean;
  /** Read at build time (inlined into the bundle, or a Docker build argument). */
  build?: boolean;
  /** The default outside production, as documented. */
  default?: string;
  doc: string;
  schema: z.ZodTypeAny;
}

const text = z.string().min(1);
const url = z.string().url();
const secret32 = z.string().min(32, "must be at least 32 characters");
const onOff = z.enum(["on", "off"]);
const bool = z.enum(["true", "false"]);
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const uuid = z.string().uuid("must be a collection UUID");
const size = z.string().regex(/^(unlimited|\d+(\.\d+)?\s*(MB|GB|TB)?)$/i, "a size: 500MB, 200GB, 1TB or unlimited");
const minutes = z.string().regex(/^(unlimited|\d+)$/i, "a number of minutes or unlimited");
const csv = z.string();

const v = (name: string, context: EnvContext, need: EnvNeed, schema: z.ZodTypeAny, doc: string, extra: Partial<EnvVar> = {}): EnvVar => ({
  name,
  context,
  need,
  schema,
  doc,
  ...extra,
});

/** Every variable, grouped by context. Platform variables (NODE_ENV, PORT, HOSTNAME) are the runtime's, not listed. */
export const ENV_VARS: readonly EnvVar[] = [
  // ── APP ──
  v("NEXT_PUBLIC_APP_URL", "APP", "required", url, "Public origin: links in e-mails, payment return URLs, IPN callbacks, OAuth redirects.", { build: true, default: "http://localhost:3000" }),
  v("NEXT_PUBLIC_APP_ENV", "APP", "optional", z.enum(["local", "dev", "staging", "production"]), "The build badge next to the brand (`v<version> · <env> · <commit>`), never shown with `production`.", { build: true, default: "local" }),
  v("APP_COMMIT_SHA", "APP", "optional", text, "The commit the image is built from (App Platform: `${_self.COMMIT_HASH}`, its Docker build has no `.git`); else `git rev-parse`.", { build: true }),
  v("APP_SEARCH_INDEXING", "APP", "optional", onOff, "`off` on dev and preview deployments: every page noindex, robots.txt disallows all. Only production is indexed.", { build: true, default: "on" }),
  v("APP_VIDEO_BANNER", "APP", "optional", onOff, "`on` offers a profile cover that moves: a 3-6 s moment of the creator's own published video (krizaka/orochia#284). Off by default; read at request time. Reduced motion, Save-Data and slow connections always get the poster.", { default: "off" }),
  v("APP_PUBLIC_ACTIONS", "APP", "optional", onOff, "`off` on dev: a signed-out visitor's story views and shares are answered but not counted; sign-in stays as it is.", { default: "on" }),
  v("APP_IOS_TEAM_ID", "APP", "optional", text, "The Apple Team ID (10 characters) in `/.well-known/apple-app-site-association`, so https links open the iOS app. Without it the file is not served (404)."),
  v("APP_ANDROID_CERT_SHA256", "APP", "optional", text, "Comma-separated SHA-256 fingerprints of the Android signing certificate (`eas credentials`) in `/.well-known/assetlinks.json`, so https links open the Android app. Without it the file is not served (404)."),
  v("APP_DEMO_MODE", "APP", "optional", bool, "Local only: the login page switches between seeded demo accounts; payments settle without a gateway. Ignored in production."),
  // ── DATABASE ──
  v("DATABASE_URL", "DATABASE", "required", text, "PostgreSQL 16 connection string."),
  v("DATABASE_DIRECT_URL", "DATABASE", "optional", text, "Direct (session) connection for LISTEN/NOTIFY and migrations when DATABASE_URL is a PgBouncer transaction pool. Defaults to DATABASE_URL."),
  v("DATABASE_CA_CERT", "DATABASE", "recommended", text, "CA of a managed PostgreSQL (PEM; App Platform: `${<db>.CA_CERT}`): TLS is verified against it."),
  v("DATABASE_MAX_CONNECTIONS", "DATABASE", "optional", int(1, 50), "Connections one instance's pool may hold — see *Database connections*.", { default: "5" }),
  v("DATABASE_ALLOW_RESET", "DATABASE", "optional", bool, "Factory reset from the admin console, and rebuild by the release job when migrations were squashed. Never honoured on the indexed production."),
  // ── AUTH ──
  v("AUTH_SESSION_SECRET", "AUTH", "required", secret32, "Signs sessions: ≥ 32 random characters (`openssl rand -hex 32`).", { secret: true }),
  v("AUTH_OWNER_EMAIL", "AUTH", "recommended", z.string().email(), "The platform owner (ADMIN, verified), created or reactivated by the release job — see *Owner account*."),
  v("AUTH_OWNER_USERNAME", "AUTH", "recommended", text, "The owner's username."),
  v("AUTH_OWNER_NAME", "AUTH", "recommended", text, "The owner's display name."),
  v("AUTH_OWNER_PASSWORD", "AUTH", "optional", z.string().min(10), "Only to create the owner (10+ characters); an existing account keeps its password.", { secret: true }),
  v("AUTH_OWNER_ROLE", "AUTH", "optional", z.string().regex(/^(admin|creator|member)$/i, "must be ADMIN, CREATOR or MEMBER"), "The owner's role.", { default: "ADMIN" }),
  v("AUTH_TEST_FAN_EMAIL", "AUTH", "optional", z.string().email(), "QA fan account, injected by `npm run db:test-accounts` (packages/db) — e-mail."),
  v("AUTH_TEST_FAN_USERNAME", "AUTH", "optional", text, "QA fan account — username."),
  v("AUTH_TEST_FAN_PASSWORD", "AUTH", "optional", z.string().min(12), "QA fan account — password (12+ characters). Never printed.", { secret: true }),
  v("AUTH_TEST_CREATOR_EMAIL", "AUTH", "optional", z.string().email(), "QA creator account, injected by `npm run db:test-accounts` — e-mail."),
  v("AUTH_TEST_CREATOR_USERNAME", "AUTH", "optional", text, "QA creator account — username."),
  v("AUTH_TEST_CREATOR_PASSWORD", "AUTH", "optional", z.string().min(12), "QA creator account — password (12+ characters). Never printed.", { secret: true }),
  v("AUTH_TEST_VIEWER_EMAIL", "AUTH", "optional", z.string().email(), "QA viewer whose age was never checked (no date of birth), injected by `npm run db:test-accounts` — e-mail."),
  v("AUTH_TEST_VIEWER_USERNAME", "AUTH", "optional", text, "QA viewer whose age was never checked — username."),
  v("AUTH_TEST_VIEWER_PASSWORD", "AUTH", "optional", z.string().min(12), "QA viewer whose age was never checked — password (12+ characters). Never printed.", { secret: true }),
  v("AUTH_TEST_DATE_OF_BIRTH", "AUTH", "optional", text, "QA accounts' date of birth (YYYY-MM-DD, 18+); default 1990-01-01."),
  v("AUTH_SIGNUP_ENABLED", "AUTH", "optional", bool, "Opens sign-up (the form, `/api/auth/register`, new Google / Facebook accounts). Off by default: a development deployment is closed to newcomers (403 `signup_disabled`), existing accounts still sign in. Read at request time; `/api/auth/providers` and `/api/auth/me` expose it as `signupEnabled`.", { default: "false" }),
  v("AUTH_GOOGLE_CLIENT_ID", "AUTH", "optional", text, "Sign in with Google — offered only with its secret too. See *Sign-in providers*."),
  v("AUTH_GOOGLE_CLIENT_SECRET", "AUTH", "optional", text, "Sign in with Google: the OAuth client secret.", { secret: true }),
  v("AUTH_FACEBOOK_APP_ID", "AUTH", "optional", text, "Sign in with Facebook — offered only with its secret too."),
  v("AUTH_FACEBOOK_APP_SECRET", "AUTH", "optional", text, "Sign in with Facebook: the app secret.", { secret: true }),
  // ── MEDIA ──
  v("MEDIA_STREAM_API_KEY", "MEDIA", "required", text, "Video library (Bunny Stream) API key.", { secret: true }),
  v("MEDIA_STREAM_LIBRARY_ID", "MEDIA", "required", int(1, Number.MAX_SAFE_INTEGER), "Video library id."),
  v("MEDIA_STREAM_HOSTNAME", "MEDIA", "required", text, "The library's delivery hostname (`vz-….b-cdn.net`)."),
  v("MEDIA_STREAM_TOKEN_AUTH_KEY", "MEDIA", "required", text, "Signs playback URLs (edge token authentication, 300 s).", { secret: true }),
  v("MEDIA_STREAM_WEBHOOK_SECRET", "MEDIA", "required", text, "The library's Read-Only API key: every encode webhook is signed with it (v1, HMAC-SHA256).", { secret: true }),
  v("MEDIA_STREAM_TOKEN_BIND_IP", "MEDIA", "optional", onOff, "Binds signed playback URLs to the viewer's IP. Off by default.", { default: "off" }),
  v("MEDIA_STREAM_COLLECTION_ID", "MEDIA", "optional", uuid, "Collection every new video is filed in."),
  v("MEDIA_STREAM_STORIES_COLLECTION_ID", "MEDIA", "optional", uuid, "Collection of story videos (else the first)."),
  v("MEDIA_STREAM_DRAFTS_COLLECTION_ID", "MEDIA", "optional", uuid, "Collection of editor drafts' originals (else the first)."),
  v("MEDIA_STORAGE_PROVIDER", "MEDIA", "required", z.enum(["local", "bunny"]), "Where pictures, drafts' music and 2257 documents are kept: `local` disk (development) or `bunny` (production: container disks are ephemeral).", { default: "local" }),
  v("MEDIA_STORAGE_API_KEY", "MEDIA", "required", text, "Storage zone password (`bunny`).", { secret: true }),
  v("MEDIA_STORAGE_ZONE", "MEDIA", "required", text, "Storage zone name (`bunny`)."),
  v("MEDIA_STORAGE_ENDPOINT", "MEDIA", "optional", text, "Storage API host of the zone's region.", { default: "storage.bunnycdn.com" }),
  v("MEDIA_STORAGE_ZONE_ID", "MEDIA", "optional", int(1, Number.MAX_SAFE_INTEGER), "The zone's numeric id for reconciliation (else searched by name)."),
  v("MEDIA_CDN_HOSTNAME", "MEDIA", "required", text, "Pull zone hostname that serves the storage zone."),
  v("MEDIA_WATERMARK_SINCE", "MEDIA", "optional", text, "ISO date from which the Stream library burns the Orochia watermark into new encodes (scripts/bunny-library.mjs --watermark on). Videos created from then on do not get the player's own overlay (one mark, not two). Unset = the burned-in watermark is off.", {}),
  v("MEDIA_ACCOUNT_API_KEY", "MEDIA", "optional", text, "Account API key: reconciliation also records the library's and the zone's billed totals.", { secret: true }),
  v("MEDIA_DRAFT_RETENTION_DAYS", "MEDIA", "optional", int(1, 365), "Days an editor draft is kept, then removed with its files.", { default: "30" }),
  v("MEDIA_DRAFTS_MAX_PER_USER", "MEDIA", "optional", int(1, 200), "Editor drafts an account may keep.", { default: "20" }),
  // ── MAIL ──
  v("MAIL_PROVIDER", "MAIL", "recommended", z.enum(["resend", "mailgun"]), "Transactional e-mail service. Unset: nothing is sent (records are written first) — see *E-mail*."),
  v("MAIL_API_KEY", "MAIL", "recommended", text, "The provider's API key.", { secret: true }),
  v("MAIL_DOMAIN", "MAIL", "optional", text, "Sending domain (`mailgun`).", { default: "mg.orochia.com" }),
  v("MAIL_API_URL", "MAIL", "optional", url, "Mailgun API base (EU region: `https://api.eu.mailgun.net`).", { default: "https://api.mailgun.net" }),
  v("MAIL_FROM", "MAIL", "optional", text, "Sender address.", { default: "Orochia <no-reply@mg.orochia.com>" }),
  v("MAIL_DELIVERY", "MAIL", "optional", onOff, "Outside production nothing leaves (messages go to the log) unless `on`."),
  v("MAIL_COMPLIANCE_ALERT_TO", "MAIL", "recommended", text, "Receives every content report (`[URGENT]` for underage / non-consensual); comma-separated."),
  v("MAIL_TEMPLATES_SOURCE", "MAIL", "optional", z.enum(["local", "bunny"]), "Templates from this repository or from `mail-templates/` in the storage zone (bundled ones as fallback).", { default: "local (bunny in production)" }),
  v("MAIL_TEMPLATES_CACHE_TTL", "MAIL", "optional", int(0, 86400), "Seconds a template read from storage is kept in memory.", { default: "300" }),
  v("MAIL_TEMPLATES_DIR", "MAIL", "optional", text, "Another folder of templates.", { default: "apps/web/mail-templates" }),
  // ── PUSH ──
  v("PUSH_DELIVERY", "PUSH", "optional", onOff, "Pushes (Expo Push Service) leave only in production or with `on`; `off` stops them in production too."),
  v("PUSH_ACCESS_TOKEN", "PUSH", "optional", text, "Expo access token — only when enhanced push security is on in the Expo project.", { secret: true }),
  // ── PAYMENTS ──
  v("PAYMENTS_PAYOUT_ENCRYPTION_KEY", "PAYMENTS", "required", secret32, "Encrypts payout account details at rest (AES-256-GCM, ≥ 32 characters). Keep it: changing it makes saved payout accounts unreadable.", { secret: true }),
  v("PAYMENTS_PLATFORM_FEE_PERCENTAGE", "PAYMENTS", "optional", int(0, 100), "The platform's share of every sale.", { default: "10" }),
  v("PAYMENTS_CREDITS_MODE", "PAYMENTS", "optional", z.enum(["test", "always-approve", "off"]), "`test` adds a free test top-up to the wallet. Ignored on the indexed public deployment."),
  v("PAYMENTS_CCBILL_CLIENT_ACCOUNT", "PAYMENTS", "optional", text, "CCBill (FlexForms dynamic pricing) — a gateway is offered only when all its variables are set."),
  v("PAYMENTS_CCBILL_CLIENT_SUBACCOUNT", "PAYMENTS", "optional", text, "CCBill sub-account."),
  v("PAYMENTS_CCBILL_FORM_NAME", "PAYMENTS", "optional", text, "CCBill FlexForm."),
  v("PAYMENTS_CCBILL_SALT", "PAYMENTS", "optional", text, "CCBill dynamic-pricing salt.", { secret: true }),
  v("PAYMENTS_CCBILL_WEBHOOK_SECRET", "PAYMENTS", "optional", text, "Signs CCBill postbacks (HMAC-SHA256, `X-CCBill-Signature`).", { secret: true }),
  v("PAYMENTS_SEGPAY_MERCHANT_ID", "PAYMENTS", "optional", text, "Segpay merchant."),
  v("PAYMENTS_SEGPAY_PACKAGE_ID", "PAYMENTS", "optional", text, "Segpay package."),
  v("PAYMENTS_SEGPAY_SECRET_KEY", "PAYMENTS", "optional", text, "Signs Segpay postbacks (HMAC-SHA256).", { secret: true }),
  v("PAYMENTS_NOWPAYMENTS_API_KEY", "PAYMENTS", "optional", text, "NowPayments (crypto) API key.", { secret: true }),
  v("PAYMENTS_NOWPAYMENTS_IPN_SECRET", "PAYMENTS", "optional", text, "Signs NowPayments IPN callbacks (HMAC-SHA512).", { secret: true }),
  v("PAYMENTS_STRIPE_SECRET_KEY", "PAYMENTS", "optional", text, "Stripe secret key.", { secret: true }),
  v("PAYMENTS_STRIPE_WEBHOOK_SECRET", "PAYMENTS", "optional", text, "Signs Stripe webhooks (`Stripe-Signature` v1).", { secret: true }),
  // ── REALTIME ──
  v("REALTIME_BUS", "REALTIME", "optional", z.enum(["memory", "postgres", "redis"]), "The bus behind streams and presence: PostgreSQL LISTEN/NOTIFY (one to ~3 instances), Redis/Valkey beyond, memory for tests — see *Realtime*.", { default: "postgres" }),
  v("REALTIME_REDIS_URL", "REALTIME", "optional", url, "Redis / Valkey URL — required with `REALTIME_BUS=redis`.", { secret: true }),
  v("REALTIME_STREAM_MAX_SECONDS", "REALTIME", "optional", int(0, 86400), "A stream ends after this long and the client resumes at once.", { default: "300" }),
  v("REALTIME_PREFIX", "REALTIME", "optional", text, "Channel prefix on the bus.", { default: "orochia:rt:" }),
  // ── ABUSE ──
  v("ABUSE_RATE_LIMIT_STORE", "ABUSE", "recommended", z.enum(["memory", "postgres"]), "Rate-limit counters: `memory` (one instance) or `postgres` (shared — required with 2+ instances).", { default: "memory" }),
  v("ABUSE_CLIENT_IP_HEADER", "ABUSE", "recommended", text, "The header the edge puts the visitor's address in (App Platform: `do-connecting-ip`)."),
  v("ABUSE_TRUSTED_PROXY_HOPS", "ABUSE", "optional", int(0, 10), "Else: the entry this far from the right of `X-Forwarded-For`.", { default: "1" }),
  v("ABUSE_BOT_CHALLENGE", "ABUSE", "recommended", z.enum(["auto", "required", "off"]), "Cloudflare Turnstile on sign-up and password reset: `auto` (on when both keys are set), `required`, `off`.", { default: "auto" }),
  v("ABUSE_BOT_CHALLENGE_SITE_KEY", "ABUSE", "recommended", text, "Turnstile site key (an Invisible widget)."),
  v("ABUSE_BOT_CHALLENGE_SECRET_KEY", "ABUSE", "recommended", text, "Turnstile secret key.", { secret: true }),
  v("ABUSE_SIGNUP_MIN_FILL_SECONDS", "ABUSE", "optional", int(0, 600), "Seconds a sign-up form must have been open (bots are faster).", { default: "3" }),
  v("ABUSE_BLOCKED_EMAIL_DOMAINS", "ABUSE", "optional", csv, "Extra refused e-mail domains (comma-separated)."),
  v("ABUSE_ALLOWED_EMAIL_DOMAINS", "ABUSE", "optional", csv, "Domains let through the disposable-address list."),
  v("ABUSE_QUOTAS", "ABUSE", "optional", onOff, "Storage quotas (not the rate limits). `off` is refused in production without `ABUSE_QUOTAS_OFF_CONFIRMED=true` — see *Storage quotas*.", { default: "on" }),
  v("ABUSE_QUOTAS_OFF_CONFIRMED", "ABUSE", "optional", bool, "Records the decision to run production without quotas."),
  v("ABUSE_QUOTA_PLATFORM_GB", "ABUSE", "recommended", size, "The whole platform's storage: past it, new uploads are refused.", { default: "100" }),
  v("ABUSE_QUOTA_PLATFORM_MINUTES", "ABUSE", "optional", minutes, "The whole platform's video minutes.", { default: "unlimited" }),
  v("ABUSE_QUOTA_ALERT_THRESHOLDS", "ABUSE", "optional", csv, "Percentages of the platform cap that alert the operators once each.", { default: "80,95" }),
  v("ABUSE_QUOTA_CREATOR_DEFAULT_GB", "ABUSE", "recommended", size, "A creator's storage when no plan is set.", { default: "10" }),
  v("ABUSE_QUOTA_CREATOR_DEFAULT_MINUTES", "ABUSE", "optional", minutes, "A creator's video minutes when no plan is set.", { default: "600" }),
  v("ABUSE_QUOTA_PLANS", "ABUSE", "optional", text, "Named plans an operator gives an account (`name=<size>/<minutes>min`, comma-separated).", { default: "pro=100GB/3000min,unlimited=unlimited" }),
  v("ABUSE_QUOTA_ADMIN_PLAN", "ABUSE", "optional", text, "The plan of ADMIN accounts (the owner).", { default: "unlimited" }),
  v("ABUSE_QUOTA_VIDEO_MAX_MB", "ABUSE", "optional", int(1, 4096), "Per video file, under the hard limit (4 GB).", { default: "4096" }),
  v("ABUSE_QUOTA_VIDEO_MAX_MINUTES", "ABUSE", "optional", int(1, 180), "Per video, under the hard limit (180 min).", { default: "180" }),
  v("ABUSE_QUOTA_STORY_MAX_MB", "ABUSE", "optional", int(1, 250), "Per story video (250 MB hard limit).", { default: "250" }),
  v("ABUSE_QUOTA_DRAFT_MAX_MB", "ABUSE", "optional", int(1, 400), "Per draft original (400 MB hard limit).", { default: "400" }),
  v("ABUSE_QUOTA_UPLOADS_PER_DAY", "ABUSE", "optional", int(1, 100000), "Upload sessions (videos, video stories, drafts) per account and 24 h.", { default: "50" }),
  v("ABUSE_QUOTA_CONCURRENT_UPLOADS", "ABUSE", "optional", int(1, 1000), "Upload sessions still waiting for their bytes, per account.", { default: "3" }),
  v("ABUSE_QUOTA_IMAGE_UPLOADS_PER_DAY", "ABUSE", "optional", int(1, 100000), "Pictures (avatars, covers, thumbnails, story images) per account and day.", { default: "100" }),
  v("ABUSE_QUOTA_RECONCILE_INTERVAL_MINUTES", "ABUSE", "optional", int(0, 100000), "Reconciliation with the media provider every N minutes (0: never).", { default: "360" }),
  // ── OBSERVABILITY ──
  v("OBSERVABILITY_METRICS_TOKEN", "OBSERVABILITY", "required", text, "Bearer token for `/api/metrics`.", { secret: true }),
  // ── AI ──
  v("AI_ENGINE_URL", "AI", "optional", url, "Base URL of the Orazaka edge (its `/edge` path): the Explorer's semantic search and recommendations. Unset: the Explorer runs on full-text search alone."),
  v("AI_ENGINE_API_KEY", "AI", "optional", z.string().regex(/^oz_/, "an Orazaka API key (oz_…)"), "Orochia's Orazaka service key, scoped `ai:embed reco:sync reco:read` (embeddings, the recommender — ADR-078). Without it Orochia does not call Orazaka.", { secret: true }),
  v("AI_PSEUDONYM_KEY", "AI", "recommended", secret32, "The HMAC key that turns an account id into the pseudonym Orazaka's recommender knows (never the id itself). Without it in production nothing is sent to the recommender; rotating it forgets every profile.", { secret: true, default: "derived from AUTH_SESSION_SECRET" }),
  // ── OPERATOR ──
  v("OPERATOR_API_TOKEN", "OPERATOR", "recommended", secret32, "Service token of the operator console (32+ characters, the same value on both deployments): opens ADMIN routes only, acting as the owner. Unset: refused.", { secret: true }),
];

const BY_NAME = new Map(ENV_VARS.map((e) => [e.name, e]));

/** The declaration of a variable; throws for an undeclared name (a typo, or a variable missing from ENV_VARS). */
export function envVar(name: string): EnvVar {
  const found = BY_NAME.get(name);
  if (!found) throw new Error(`${name} is not declared in apps/web/lib/env.ts (ENV_VARS)`);
  return found;
}

/**
 * Checks an environment against ENV_VARS: every value set must match its schema; in production every `required`
 * variable must be set, the `bunny` storage provider brings its own. Returns the problems, one line each (names only,
 * never a value).
 */
export function checkEnv(env: Record<string, string | undefined> = process.env): string[] {
  const production = env.NODE_ENV === "production";
  const problems: string[] = [];
  const storage = env.MEDIA_STORAGE_PROVIDER?.trim() || "local";
  for (const e of ENV_VARS) {
    const raw = env[e.name]?.trim();
    if (!raw) {
      const storageOnly = e.name === "MEDIA_STORAGE_API_KEY" || e.name === "MEDIA_STORAGE_ZONE" || e.name === "MEDIA_CDN_HOSTNAME";
      if (production && e.need === "required" && (!storageOnly || storage === "bunny")) problems.push(`${e.name} is required in production`);
      continue;
    }
    const parsed = e.schema.safeParse(raw);
    if (!parsed.success) problems.push(`${e.name} ${parsed.error.issues[0]?.message ?? "is invalid"}`);
  }
  if (production && storage !== "bunny") problems.push("MEDIA_STORAGE_PROVIDER must be bunny in production");
  if (env.REALTIME_BUS?.trim() === "redis" && !env.REALTIME_REDIS_URL?.trim()) problems.push("REALTIME_REDIS_URL is required when REALTIME_BUS=redis");
  return problems;
}

/**
 * At server start-up (instrumentation.ts). A deployed production server (NODE_ENV=production on a `dev`, `staging` or
 * `production` build) with an incomplete or malformed environment does not start: the platform keeps the previous
 * release (fail-closed). Elsewhere — development, a local `next start` such as the recorded demo — problems are logged.
 */
export function assertEnv(env: Record<string, string | undefined> = process.env, deployment = process.env.NEXT_PUBLIC_APP_ENV): void {
  const problems = checkEnv(env);
  if (problems.length === 0) return;
  const list = `\n  - ${problems.join("\n  - ")}`;
  const deployed = deployment === "dev" || deployment === "staging" || deployment === "production";
  if (env.NODE_ENV === "production" && deployed) throw new ConfigurationError("environment", `is invalid:${list}`);
  console.warn(`env: ${problems.length} problem(s) — a deployment would refuse to start:${list}`);
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Demo mode: seeded showcase accounts can be switched to from the login page. Never available in
 * production, whatever the variable says.
 */
export function isDemoMode(): boolean {
  return !isProduction() && process.env.APP_DEMO_MODE === "true";
}

function read(name: string, developmentDefault: string): string {
  const value = process.env[name];
  if (value && value.trim()) return value.trim();
  if (isProduction()) throw new ConfigurationError(name);
  return developmentDefault;
}

export function sessionSecret(): string {
  const secret = read("AUTH_SESSION_SECRET", "development-only-orochia-session-secret-0123456789");
  if (secret.length < 32) throw new ConfigurationError("AUTH_SESSION_SECRET", "must be at least 32 characters");
  return secret;
}

/** Key that encrypts payout account details at rest (AES-256-GCM). Mandatory in production; derived locally. */
export function payoutEncryptionKey(): string {
  const key = process.env.PAYMENTS_PAYOUT_ENCRYPTION_KEY?.trim();
  if (key) {
    if (key.length < 32) throw new ConfigurationError("PAYMENTS_PAYOUT_ENCRYPTION_KEY", "must be at least 32 characters");
    return key;
  }
  if (isProduction()) throw new ConfigurationError("PAYMENTS_PAYOUT_ENCRYPTION_KEY");
  return `development-payouts:${sessionSecret()}`;
}

/**
 * The key of the recommender's pseudonyms (lib/recommendations): set, or derived from the session secret outside
 * production. Null in production without it — the recommender then receives nothing (it is an addition, never a
 * dependency).
 */
export function pseudonymKey(): string | null {
  const key = process.env.AI_PSEUDONYM_KEY?.trim();
  if (key) {
    if (key.length < 32) throw new ConfigurationError("AI_PSEUDONYM_KEY", "must be at least 32 characters");
    return key;
  }
  if (isProduction()) return null;
  return `development-pseudonyms:${sessionSecret()}`;
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
  const libraryId = Number(read("MEDIA_STREAM_LIBRARY_ID", "1"));
  if (!Number.isInteger(libraryId) || libraryId <= 0) {
    throw new ConfigurationError("MEDIA_STREAM_LIBRARY_ID", "must be a positive integer");
  }
  // Optional: the Bunny collections new uploads (and story videos) are filed in.
  const collectionId = process.env.MEDIA_STREAM_COLLECTION_ID?.trim() || undefined;
  if (collectionId && !UUID.test(collectionId)) {
    throw new ConfigurationError("MEDIA_STREAM_COLLECTION_ID", "must be a collection UUID");
  }
  const storiesCollectionId = process.env.MEDIA_STREAM_STORIES_COLLECTION_ID?.trim() || undefined;
  if (storiesCollectionId && !UUID.test(storiesCollectionId)) {
    throw new ConfigurationError("MEDIA_STREAM_STORIES_COLLECTION_ID", "must be a collection UUID");
  }
  const draftsCollectionId = process.env.MEDIA_STREAM_DRAFTS_COLLECTION_ID?.trim() || undefined;
  if (draftsCollectionId && !UUID.test(draftsCollectionId)) {
    throw new ConfigurationError("MEDIA_STREAM_DRAFTS_COLLECTION_ID", "must be a collection UUID");
  }
  return {
    apiKey: read("MEDIA_STREAM_API_KEY", "development-bunny-api-key"),
    libraryId,
    hostname: read("MEDIA_STREAM_HOSTNAME", "vz-development.b-cdn.net"),
    tokenAuthKey: read("MEDIA_STREAM_TOKEN_AUTH_KEY", "development-token-auth-key"),
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

/** Editor drafts: how long one is kept (MEDIA_DRAFT_RETENTION_DAYS, 30) and how many an account may keep (MEDIA_DRAFTS_MAX_PER_USER, 20). */
export function draftsConfig() {
  return { retentionDays: setting("MEDIA_DRAFT_RETENTION_DAYS", 30, 1, 365), maxPerUser: setting("MEDIA_DRAFTS_MAX_PER_USER", 20, 1, 200) };
}

/**
 * Before anything that sends video to Bunny (uploads, video stories, drafts): outside production, a library that is not
 * configured is said plainly — what to set and where it is explained — instead of failing at Bunny with placeholders.
 */
export function requireBunnyStream(): BunnyStreamConfig {
  if (!isProduction() && !process.env.MEDIA_STREAM_API_KEY?.trim()) {
    throw new ConfigurationError(
      "MEDIA_STREAM_API_KEY",
      "is not set: uploads, video stories and drafts need a Bunny Stream library (docs/DEVELOPMENT.md, “Video features locally”)",
    );
  }
  return bunnyStreamConfig();
}

/** The Stream library's Read-Only API key: Bunny signs every webhook with it (signature v1). */
export function bunnyWebhookSecret(): string {
  return read("MEDIA_STREAM_WEBHOOK_SECRET", "");
}

/** Bearer token protecting /api/metrics; mandatory in production. */
export function metricsToken(): string | null {
  const token = process.env.OBSERVABILITY_METRICS_TOKEN;
  if (token && token.trim()) return token.trim();
  if (isProduction()) throw new ConfigurationError("OBSERVABILITY_METRICS_TOKEN");
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
 * at `REALTIME_REDIS_URL`, for several instances and many streams) or `memory` (one process: tests). Fail-closed: `redis`
 * without a URL is a configuration error, never a silent fallback.
 */
export function realtimeConfig(env: Record<string, string | undefined> = process.env): RealtimeConfig {
  const kind = (env.REALTIME_BUS?.trim().toLowerCase() || "postgres") as RealtimeConfig["kind"];
  if (kind !== "memory" && kind !== "postgres" && kind !== "redis") throw new ConfigurationError("REALTIME_BUS", "must be memory, postgres or redis");
  const redisUrl = env.REALTIME_REDIS_URL?.trim() || undefined;
  if (kind === "redis" && !redisUrl) throw new ConfigurationError("REALTIME_REDIS_URL", "is required when REALTIME_BUS=redis");
  const max = Number(env.REALTIME_STREAM_MAX_SECONDS ?? 300);
  return {
    kind,
    redisUrl,
    prefix: env.REALTIME_PREFIX?.trim() || "orochia:rt:",
    streamMaxSeconds: Number.isFinite(max) && max >= 0 ? max : 300,
  };
}
