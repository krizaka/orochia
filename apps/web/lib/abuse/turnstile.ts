import { ConfigurationError } from "../env";
import { HttpError } from "../http";

/**
 * Bot challenge: **Cloudflare Turnstile**, chosen over hCaptcha because its "Invisible" widget asks people nothing in
 * the vast majority of cases (no image puzzle), it is free without a request quota, it does not resell or profile
 * visitors, and the site key / secret are all it needs. The widget type ("Invisible") is chosen when the site key is
 * created in the Cloudflare dashboard.
 *
 * `BOT_CHALLENGE`:
 * - `auto` (default): on when `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are both set, off otherwise (like a
 *   sign-in provider, a challenge exists only once configured — local development and CI need no key);
 * - `required`: in production, a missing key refuses the protected actions (503) instead of running without;
 * - `off`: never (a documented decision, e.g. while the keys are being created).
 *
 * When Cloudflare cannot be reached the outcome depends on the action: **sign-up and password reset fail closed**
 * (refused, 503 CHALLENGE_UNAVAILABLE — an account or an e-mail costs nothing to retry later, and an outage is exactly
 * when a bot wave would pass), **content reports fail open** (accepted — a report of abuse must never be lost to a
 * third party's outage), and reading is never challenged.
 */
export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface ChallengeConfig {
  mode: "auto" | "required" | "off";
  siteKey: string | null;
  secretKey: string | null;
  /** True when protected actions must carry a solved challenge. */
  active: boolean;
}

export function challengeConfig(env: Record<string, string | undefined> = process.env): ChallengeConfig {
  const raw = env.BOT_CHALLENGE?.trim().toLowerCase() || "auto";
  const mode = raw === "off" || raw === "required" ? raw : "auto";
  const siteKey = env.TURNSTILE_SITE_KEY?.trim() || null;
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim() || null;
  if (mode === "off") return { mode, siteKey, secretKey, active: false };
  if (siteKey && secretKey) return { mode, siteKey, secretKey, active: true };
  if (mode === "required" && (env.NODE_ENV ?? process.env.NODE_ENV) === "production") {
    throw new ConfigurationError("TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY", "are required when BOT_CHALLENGE=required");
  }
  return { mode, siteKey, secretKey, active: false };
}

/** What the browser needs to show the widget (the site key is public), or null when no challenge is asked. */
export function publicChallenge(env: Record<string, string | undefined> = process.env): { provider: "turnstile"; siteKey: string } | null {
  try {
    const config = challengeConfig(env);
    return config.active && config.siteKey ? { provider: "turnstile", siteKey: config.siteKey } : null;
  } catch {
    return null;
  }
}

export type ChallengeOutcome = { ok: true; skipped?: boolean; unavailable?: boolean } | { ok: false; reason: "missing" | "rejected" | "unavailable" };

/**
 * Checks a Turnstile response token with Cloudflare (4 s timeout). `failMode` decides what an unreachable Cloudflare
 * means: `closed` refuses, `open` accepts. A missing or rejected token is always refused.
 */
export async function verifyChallenge(
  token: string | null | undefined,
  options: { ip?: string | null; failMode: "closed" | "open"; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<ChallengeOutcome> {
  const config = challengeConfig(options.env);
  if (!config.active) return { ok: true, skipped: true };
  if (!token || token.length > 2048) return { ok: false, reason: "missing" };
  const body = new URLSearchParams({ secret: config.secretKey!, response: token });
  if (options.ip) body.set("remoteip", options.ip);
  try {
    const res = await (options.fetchImpl ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 4000),
    });
    if (!res.ok) throw new Error(`siteverify answered ${res.status}`);
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success === true) return { ok: true };
    const codes = data["error-codes"] ?? [];
    // An error on OUR side (bad secret) is an outage, not a bot.
    if (codes.some((c) => c === "missing-input-secret" || c === "invalid-input-secret" || c === "internal-error")) throw new Error(codes.join(","));
    return { ok: false, reason: "rejected" };
  } catch (error) {
    console.error(`bot challenge: Cloudflare unreachable (${options.failMode === "open" ? "accepted" : "refused"})`, error instanceof Error ? error.message : error);
    return options.failMode === "open" ? { ok: true, unavailable: true } : { ok: false, reason: "unavailable" };
  }
}

/** {@link verifyChallenge}, throwing the refusal: 400 CHALLENGE_FAILED, or 503 CHALLENGE_UNAVAILABLE when failing closed. */
export async function requireChallenge(token: string | null | undefined, options: { ip?: string | null; failMode: "closed" | "open" }) {
  const outcome = await verifyChallenge(token, options);
  if (outcome.ok) return outcome;
  if (outcome.reason === "unavailable") {
    throw new HttpError(503, "The anti-bot check is unavailable right now. Try again in a few minutes.", { code: "CHALLENGE_UNAVAILABLE" }, { "Retry-After": "60" });
  }
  throw new HttpError(400, "The anti-bot check failed. Try again.", { code: "CHALLENGE_FAILED" });
}

