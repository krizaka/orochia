import crypto from "crypto";

import { sessionSecret } from "../env";
import { HttpError } from "../http";
import { DISPOSABLE_EMAIL_DOMAINS } from "./disposable-email-domains";

/**
 * Sign-up defences that cost a person nothing:
 *
 * - **Form token** — the form asks `GET /api/auth/register` for a token signed with the session secret, bound to this
 *   browser's device cookie and its issue time. The account is created only with a token at least
 *   `ABUSE_SIGNUP_MIN_FILL_SECONDS` old (default 3: nobody fills the form faster) and at most 2 hours old. A script must run
 *   JavaScript-like steps, keep cookies and wait — and the device cookie lets sign-ups be limited per device too.
 * - **Honeypot** — a field (`website`) hidden from people and assistive technology; a bot that fills every input
 *   fills it, and is refused.
 * - **Disposable e-mail domains** — refused (`disposable-email-domains.ts`, `ABUSE_BLOCKED_EMAIL_DOMAINS`,
 *   `ABUSE_ALLOWED_EMAIL_DOMAINS`).
 * Refusals carry stable codes; they say no more than needed.
 */
export const DEVICE_COOKIE = "orochia_device";
/**
 * The native app has no browser cookie: it sends the same kind of random device id (made once per install and kept in
 * the device's secure storage) in this header. The rules are the same — a token bound to that id, the per-device limit.
 * Rotating it is no easier than clearing a browser's cookies, so it opens no shortcut.
 */
export const DEVICE_HEADER = "x-orochia-device";
export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const FORM_TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function minFillSeconds(env: Record<string, string | undefined> = process.env): number {
  const raw = env.ABUSE_SIGNUP_MIN_FILL_SECONDS?.trim();
  if (!raw) return 3;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 60 ? value : 3;
}

/** A fresh random device id (the value of the device cookie). */
export const newDeviceId = () => crypto.randomBytes(16).toString("base64url");
const validDevice = (id: string | undefined | null): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(id);

function mac(data: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(`signup-form:${data}`).digest("base64url");
}

/** The token a sign-up form posts back: `v1.<issued ms>.<hmac(issued, device)>`. */
export function issueFormToken(deviceId: string, now = Date.now(), secret = sessionSecret()): string {
  return `v1.${now}.${mac(`${now}.${deviceId}`, secret)}`;
}

export type FormTokenProblem = "FORM_TOKEN_MISSING" | "FORM_TOKEN_INVALID" | "FORM_TOO_FAST" | "FORM_EXPIRED";

/** Why a form token is refused, or null when it is good for this device at this time. */
export function formTokenProblem(
  token: string | undefined | null,
  deviceId: string | undefined | null,
  options: { now?: number; secret?: string; minSeconds?: number } = {},
): FormTokenProblem | null {
  if (!token) return "FORM_TOKEN_MISSING";
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d{10,16}$/.test(parts[1]) || !validDevice(deviceId)) return "FORM_TOKEN_INVALID";
  const issued = Number(parts[1]);
  const expected = Buffer.from(mac(`${issued}.${deviceId}`, options.secret ?? sessionSecret()));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return "FORM_TOKEN_INVALID";
  const now = options.now ?? Date.now();
  if (now - issued < (options.minSeconds ?? minFillSeconds()) * 1000) return "FORM_TOO_FAST";
  if (now - issued > FORM_TOKEN_MAX_AGE_MS || issued > now + 60_000) return "FORM_EXPIRED";
  return null;
}

export function assertFormToken(token: string | undefined | null, deviceId: string | undefined | null) {
  const problem = formTokenProblem(token, deviceId);
  if (!problem) return;
  // Too fast is a bot; the others are a stale page or a forged token. Either way: reload the form.
  console.warn(`abuse: sign-up form token refused (${problem})`);
  throw new HttpError(400, problem === "FORM_EXPIRED" ? "This form has expired. Reload the page and try again." : "Please try again.", { code: problem });
}

/** The honeypot field: anything in it is a bot (people never see it). */
export function assertHoneypot(value: unknown) {
  if (typeof value === "string" && value.trim() !== "") {
    console.warn("abuse: sign-up honeypot filled");
    throw new HttpError(400, "Please try again.", { code: "BOT_SUSPECTED" });
  }
}

const listFromEnv = (value: string | undefined) =>
  (value ?? "")
    .split(/[\s,]+/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

/** True when the address's domain (or a parent domain) is a disposable e-mail service. */
export function isDisposableEmail(email: string, env: Record<string, string | undefined> = process.env): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  const allowed = new Set(listFromEnv(env.ABUSE_ALLOWED_EMAIL_DOMAINS));
  const blocked = new Set([...DISPOSABLE_EMAIL_DOMAINS, ...listFromEnv(env.ABUSE_BLOCKED_EMAIL_DOMAINS)]);
  const labels = domain.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const candidate = labels.slice(i).join(".");
    if (allowed.has(candidate)) return false;
    if (blocked.has(candidate)) return true;
  }
  return false;
}

export function assertEmailDomainAllowed(email: string) {
  if (isDisposableEmail(email)) {
    throw new HttpError(400, "Disposable e-mail addresses are not accepted. Use an address you keep.", { code: "EMAIL_DOMAIN_REFUSED" });
  }
}

/** The device a sign-up comes from: the app's header when it sends one, else the browser's device cookie. */
export function signupDeviceId(headers: Headers, cookieValue: string | undefined | null): string | undefined {
  const fromHeader = headers.get(DEVICE_HEADER)?.trim();
  if (validDevice(fromHeader)) return fromHeader;
  return validDevice(cookieValue) ? cookieValue : undefined;
}

export { validDevice as isDeviceId };
