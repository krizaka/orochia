import { UPLOAD_LIMITS, type UploadKind } from "@orochia/media/limits";

import { ConfigurationError } from "./env";

/**
 * Storage quotas — pure rules (no database, no network), configured by environment. `lib/storage-usage.ts` measures and
 * applies them; this file decides. Units: bytes and seconds; `null` means unlimited.
 *
 * Variables (documented in `.env.example` and docs/DEPLOYMENT.md):
 * - `ABUSE_QUOTAS` on (default) | off — off disables every quota below (not the rate limits). Refused in production
 *   unless `ABUSE_QUOTAS_OFF_CONFIRMED=true` records the decision (uploads answer 503 otherwise).
 * - `ABUSE_QUOTA_PLATFORM_GB` (100), `ABUSE_QUOTA_PLATFORM_MINUTES` (unlimited) — the whole platform: past it, new uploads are refused.
 * - `ABUSE_QUOTA_ALERT_THRESHOLDS` (80,95) — percentages of the platform cap that alert the operators once each.
 * - `ABUSE_QUOTA_CREATOR_DEFAULT_GB` (10), `ABUSE_QUOTA_CREATOR_DEFAULT_MINUTES` (600) — a creator's plan when none is set.
 * - `ABUSE_QUOTA_PLANS` (pro=100GB/3000min,unlimited=unlimited) — named plans an operator gives an account
 *   (`users.storage_plan`); a size is `500MB`, `200GB`, `1TB` or `unlimited`, minutes optional (`/6000min`).
 * - `ABUSE_QUOTA_ADMIN_PLAN` (unlimited) — the plan of ADMIN accounts (the owner) when none is set.
 * - `ABUSE_QUOTA_VIDEO_MAX_MB`, `ABUSE_QUOTA_VIDEO_MAX_MINUTES`, `ABUSE_QUOTA_STORY_MAX_MB`, `ABUSE_QUOTA_DRAFT_MAX_MB` — per-file maxima, lower
 *   than (never above) the hard limits of packages/media/src/limits.ts.
 * - `ABUSE_QUOTA_UPLOADS_PER_DAY` (50) — upload sessions (videos, video stories, drafts) per account and 24 hours.
 * - `ABUSE_QUOTA_CONCURRENT_UPLOADS` (3) — upload sessions still waiting for their bytes, per account.
 * - `ABUSE_QUOTA_IMAGE_UPLOADS_PER_DAY` (100) — pictures (avatars, covers, thumbnails, story images) per account and day.
 */

export interface Allowance {
  bytes: number | null;
  seconds: number | null;
}

export type QuotaKind = UploadKind;

export interface QuotaConfig {
  enabled: boolean;
  platform: Allowance;
  alertThresholds: number[];
  plans: Record<string, Allowance>;
  adminPlan: string;
  perFile: Record<QuotaKind, { maxBytes: number; maxSeconds: number }>;
  uploadsPerDay: number | null;
  concurrentUploads: number | null;
  imageUploadsPerDay: number | null;
}

export const DEFAULT_PLAN = "default";
export const UNLIMITED_PLAN = "unlimited";
const GB = 1024 ** 3;
const UNITS: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB, TB: 1024 ** 4 };

/** "200GB" / "500 MB" / "1.5TB" / "unlimited" → bytes or null; a bare number is in `bareUnit`. */
export function parseSize(value: string, bareUnit: keyof typeof UNITS = "GB"): number | null {
  const text = value.trim().toUpperCase();
  if (text === "UNLIMITED" || text === "NONE" || text === "-1") return null;
  const match = /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)?$/.exec(text);
  if (!match) throw new Error(`"${value}" is not a size (e.g. 500MB, 200GB, 1TB, unlimited)`);
  return Math.round(Number(match[1]) * UNITS[match[2] ?? bareUnit]);
}

/** "600" / "unlimited" → seconds or null (the value is in minutes). */
export function parseMinutes(value: string): number | null {
  const text = value.trim().toLowerCase().replace(/\s*min$/, "");
  if (text === "unlimited" || text === "none" || text === "-1") return null;
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error(`"${value}" is not a number of minutes (or unlimited)`);
  return Math.round(Number(text) * 60);
}

/** `pro=200GB/6000min,partner=unlimited` → plans. A plan without minutes has unlimited minutes. */
export function parsePlans(value: string): Record<string, Allowance> {
  const plans: Record<string, Allowance> = {};
  for (const entry of value.split(",").map((e) => e.trim()).filter(Boolean)) {
    const [name, spec] = entry.split("=").map((p) => p?.trim());
    if (!name || !spec || !/^[a-z0-9_-]{1,40}$/i.test(name)) throw new Error(`"${entry}" is not a plan (name=200GB/6000min)`);
    const [size, minutes] = spec.split("/");
    plans[name.toLowerCase()] = { bytes: parseSize(size), seconds: minutes ? parseMinutes(minutes) : null };
  }
  return plans;
}

function readNumber(env: Record<string, string | undefined>, name: string, fallback: number | null, parse: (v: string) => number | null = (v) => parseSize(v, "B")) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  try {
    return parse(raw);
  } catch (error) {
    throw new ConfigurationError(name, error instanceof Error ? error.message : "is invalid");
  }
}

const count = (v: string) => {
  if (/^unlimited$/i.test(v.trim())) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error("must be a whole number or unlimited");
  return n;
};

/** The quota configuration from the environment. Throws a ConfigurationError (→ 503) for an invalid value. */
export function quotaConfig(env: Record<string, string | undefined> = process.env): QuotaConfig {
  const switchValue = env.ABUSE_QUOTAS?.trim().toLowerCase() || "on";
  if (switchValue !== "on" && switchValue !== "off") throw new ConfigurationError("ABUSE_QUOTAS", 'must be "on" or "off"');
  const enabled = switchValue === "on";
  if (!enabled && env.NODE_ENV === "production" && env.ABUSE_QUOTAS_OFF_CONFIRMED?.trim() !== "true") {
    throw new ConfigurationError("ABUSE_QUOTAS=off", "is refused in production without ABUSE_QUOTAS_OFF_CONFIRMED=true (an explicit decision)");
  }

  let plans: Record<string, Allowance>;
  try {
    plans = parsePlans(env.ABUSE_QUOTA_PLANS?.trim() || "pro=100GB/3000min,unlimited=unlimited");
  } catch (error) {
    throw new ConfigurationError("ABUSE_QUOTA_PLANS", error instanceof Error ? error.message : "is invalid");
  }
  plans[DEFAULT_PLAN] = {
    bytes: readNumber(env, "ABUSE_QUOTA_CREATOR_DEFAULT_GB", 10 * GB, (v) => parseSize(v, "GB")),
    seconds: readNumber(env, "ABUSE_QUOTA_CREATOR_DEFAULT_MINUTES", 600 * 60, parseMinutes),
  };
  plans[UNLIMITED_PLAN] ??= { bytes: null, seconds: null };
  const adminPlan = env.ABUSE_QUOTA_ADMIN_PLAN?.trim().toLowerCase() || UNLIMITED_PLAN;
  if (!plans[adminPlan]) throw new ConfigurationError("ABUSE_QUOTA_ADMIN_PLAN", `names no plan of ABUSE_QUOTA_PLANS ("${adminPlan}")`);

  const thresholds = (env.ABUSE_QUOTA_ALERT_THRESHOLDS?.trim() || "80,95")
    .split(",")
    .map((t) => Number(t.trim()))
    .filter((t) => Number.isFinite(t) && t > 0 && t <= 100)
    .sort((a, b) => a - b);

  const capped = (name: string, hard: number, unit: "MB" | "MIN") => {
    const value = readNumber(env, name, hard, unit === "MB" ? (v) => parseSize(v, "MB") : parseMinutes);
    return value === null ? hard : Math.min(value, hard);
  };

  return {
    enabled,
    platform: {
      bytes: readNumber(env, "ABUSE_QUOTA_PLATFORM_GB", 100 * GB, (v) => parseSize(v, "GB")),
      seconds: readNumber(env, "ABUSE_QUOTA_PLATFORM_MINUTES", null, parseMinutes),
    },
    alertThresholds: [...new Set(thresholds)],
    plans,
    adminPlan,
    perFile: {
      video: { maxBytes: capped("ABUSE_QUOTA_VIDEO_MAX_MB", UPLOAD_LIMITS.video.maxBytes, "MB"), maxSeconds: capped("ABUSE_QUOTA_VIDEO_MAX_MINUTES", UPLOAD_LIMITS.video.maxSeconds, "MIN") },
      story: { maxBytes: capped("ABUSE_QUOTA_STORY_MAX_MB", UPLOAD_LIMITS.story.maxBytes, "MB"), maxSeconds: UPLOAD_LIMITS.story.maxSeconds },
      draft: { maxBytes: capped("ABUSE_QUOTA_DRAFT_MAX_MB", UPLOAD_LIMITS.draft.maxBytes, "MB"), maxSeconds: UPLOAD_LIMITS.draft.maxSeconds },
    },
    uploadsPerDay: readNumber(env, "ABUSE_QUOTA_UPLOADS_PER_DAY", 50, count),
    concurrentUploads: readNumber(env, "ABUSE_QUOTA_CONCURRENT_UPLOADS", 3, count),
    imageUploadsPerDay: readNumber(env, "ABUSE_QUOTA_IMAGE_UPLOADS_PER_DAY", 100, count),
  };
}

/** The plan an account is on: the one an operator set (when it exists), else its role's default. */
export function planFor(account: { role: string; storagePlan?: string | null }, config: QuotaConfig): { name: string; allowance: Allowance } {
  const chosen = account.storagePlan?.trim().toLowerCase();
  if (chosen && config.plans[chosen]) return { name: chosen, allowance: config.plans[chosen] };
  const name = account.role === "ADMIN" ? config.adminPlan : DEFAULT_PLAN;
  return { name, allowance: config.plans[name] };
}

export interface Usage {
  bytes: number;
  seconds: number;
}

export type QuotaCode =
  | "STORAGE_LIMITS_UNAVAILABLE"
  | "FILE_TOO_LARGE"
  | "VIDEO_TOO_LONG"
  | "CREATOR_STORAGE_FULL"
  | "CREATOR_MINUTES_FULL"
  | "PLATFORM_STORAGE_FULL"
  | "PLATFORM_MINUTES_FULL"
  | "UPLOADS_PER_DAY"
  | "CONCURRENT_UPLOADS";

export type QuotaDecision =
  | { ok: true }
  | { ok: false; status: 413 | 429; code: QuotaCode; message: string; retryAfterSeconds?: number };

export interface UploadRequest {
  kind: QuotaKind;
  sizeBytes: number;
  /** When the browser knows it (read from the file before sending). */
  durationSeconds?: number | null;
}

export interface UploadContext {
  config: QuotaConfig;
  creator: { usage: Usage; allowance: Allowance };
  platform: { usage: Usage };
  /** Upload sessions opened in the last 24 hours, and when the oldest of them was opened. */
  today: { count: number; oldestAt: Date | null };
  /** Upload sessions still waiting for their bytes. */
  concurrent: number;
  now?: Date;
}

const over = (used: number, adding: number, limit: number | null) => limit !== null && used + adding > limit;
const GiB = (bytes: number) => `${(bytes / GB).toFixed(bytes < 10 * GB ? 1 : 0)} GB`;

/**
 * May this upload session open? Checked BEFORE the Tus signature is issued: the file's declared size (and length when
 * known) against the per-file maximum, the creator's plan and the platform's cap, then the daily and concurrent
 * counts. Messages are English (the API's); the UI shows its own words for each `code`.
 */
export function evaluateUpload(request: UploadRequest, ctx: UploadContext): QuotaDecision {
  const { config } = ctx;
  if (!config.enabled) return { ok: true };
  const file = config.perFile[request.kind];
  const seconds = Math.max(0, Math.round(request.durationSeconds ?? 0));
  if (request.sizeBytes > file.maxBytes) {
    return { ok: false, status: 413, code: "FILE_TOO_LARGE", message: `This file is larger than the ${GiB(file.maxBytes)} allowed.` };
  }
  if (seconds > file.maxSeconds + 2) {
    return { ok: false, status: 413, code: "VIDEO_TOO_LONG", message: `This video is longer than the ${Math.round(file.maxSeconds / 60)} minutes allowed.` };
  }
  if (over(ctx.platform.usage.bytes, request.sizeBytes, config.platform.bytes)) {
    return { ok: false, status: 413, code: "PLATFORM_STORAGE_FULL", message: "Uploads are paused: the platform's storage is full. Try again later." };
  }
  if (over(ctx.platform.usage.seconds, seconds, config.platform.seconds)) {
    return { ok: false, status: 413, code: "PLATFORM_MINUTES_FULL", message: "Uploads are paused: the platform's video time is full. Try again later." };
  }
  if (over(ctx.creator.usage.bytes, request.sizeBytes, ctx.creator.allowance.bytes)) {
    return { ok: false, status: 413, code: "CREATOR_STORAGE_FULL", message: `Not enough space: this file needs ${GiB(request.sizeBytes)} and your plan has ${GiB(Math.max(0, (ctx.creator.allowance.bytes ?? 0) - ctx.creator.usage.bytes))} left.` };
  }
  if (over(ctx.creator.usage.seconds, seconds, ctx.creator.allowance.seconds)) {
    return { ok: false, status: 413, code: "CREATOR_MINUTES_FULL", message: "Not enough video time left on your plan for this file." };
  }
  if (config.uploadsPerDay !== null && ctx.today.count >= config.uploadsPerDay) {
    const now = (ctx.now ?? new Date()).getTime();
    const retry = ctx.today.oldestAt ? Math.max(60, Math.ceil((ctx.today.oldestAt.getTime() + 86_400_000 - now) / 1000)) : 3600;
    return { ok: false, status: 429, code: "UPLOADS_PER_DAY", message: `You reached today's ${config.uploadsPerDay} uploads. Try again later.`, retryAfterSeconds: retry };
  }
  if (config.concurrentUploads !== null && ctx.concurrent >= config.concurrentUploads) {
    return { ok: false, status: 429, code: "CONCURRENT_UPLOADS", message: "Finish the uploads in progress before starting another.", retryAfterSeconds: 60 };
  }
  return { ok: true };
}

/**
 * Once Bunny encoded a file and its real size is known: does the creator (their usage already counts this file) or the
 * platform now exceed its limit? Then the file is HELD — kept, private — never deleted for it.
 */
export function holdAfterEncoding(ctx: { config: QuotaConfig; creator: { usage: Usage; allowance: Allowance }; platform: { usage: Usage } }): "CREATOR" | "PLATFORM" | null {
  if (!ctx.config.enabled) return null;
  const { creator, platform, config } = ctx;
  if (over(creator.usage.bytes, 0, creator.allowance.bytes) || over(creator.usage.seconds, 0, creator.allowance.seconds)) return "CREATOR";
  if (over(platform.usage.bytes, 0, config.platform.bytes) || over(platform.usage.seconds, 0, config.platform.seconds)) return "PLATFORM";
  return null;
}

/** Percentage used (0–100+, one decimal), or null when unlimited. */
export function percentUsed(used: number, limit: number | null): number | null {
  if (limit === null) return null;
  if (limit <= 0) return 100;
  return Math.round((used / limit) * 1000) / 10;
}

/** The thresholds `used / limit` has reached (e.g. [80] at 85 %), for the platform alerts. */
export function reachedThresholds(used: number, limit: number | null, thresholds: number[]): number[] {
  const percent = percentUsed(used, limit);
  if (percent === null) return [];
  return thresholds.filter((t) => percent >= t);
}

/** How full: ok · warning (≥ 80 %) · critical (≥ 95 %) · full (100 %) — the gauge's colour and message. */
export function usageLevel(used: number, limit: number | null): "ok" | "warning" | "critical" | "full" | "unlimited" {
  const percent = percentUsed(used, limit);
  if (percent === null) return "unlimited";
  if (percent >= 100) return "full";
  if (percent >= 95) return "critical";
  if (percent >= 80) return "warning";
  return "ok";
}
