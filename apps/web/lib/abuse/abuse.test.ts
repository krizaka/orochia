import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "../http";
import { memoryStore, RateLimitError, useRateLimitStore } from "../rate-limit";
import { automationSignals, refuseAutomation } from "./automation";
import { assertLoginAllowed, clearLoginFailures, lockoutSeconds, MAX_LOCK_SECONDS, recordLoginFailure } from "./login-throttle";
import { assertEmailDomainAllowed, assertHoneypot, formTokenProblem, isDisposableEmail, issueFormToken } from "./signup-guard";
import { challengeConfig, publicChallenge, requireChallenge, verifyChallenge } from "./turnstile";

const SECRET = "test-secret-0123456789-0123456789-abcdef";
const DEVICE = "AbCdEfGhIjKlMnOp0123";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  useRateLimitStore(null);
});

describe("automated clients", () => {
  it("are recognised by their headers", () => {
    expect(automationSignals(new Headers())).toEqual(["no-user-agent"]);
    expect(automationSignals(new Headers({ "user-agent": "curl/8.4.0" }))).toEqual(["scripted-client"]);
    expect(automationSignals(new Headers({ "user-agent": "Mozilla/5.0 HeadlessChrome/120" }))).toEqual(["headless-browser"]);
    expect(automationSignals(new Headers({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)" }))).toEqual([]);
    // The Android app's HTTP stack is not a script.
    expect(automationSignals(new Headers({ "user-agent": "okhttp/4.12.0" }))).toEqual([]);
  });

  it("are refused where only a person acts (403 AUTOMATION_REFUSED)", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => refuseAutomation(new Headers({ "user-agent": "python-requests/2.31" }))).toThrow(HttpError);
    try {
      refuseAutomation(new Headers());
    } catch (error) {
      expect((error as HttpError).status).toBe(403);
      expect((error as HttpError).extra.code).toBe("AUTOMATION_REFUSED");
    }
    expect(() => refuseAutomation(new Headers({ "user-agent": "Mozilla/5.0" }))).not.toThrow();
  });
});

describe("the sign-up form token", () => {
  const now = 1_800_000_000_000;
  const token = issueFormToken(DEVICE, now, SECRET);
  const check = (at: number, overrides: { token?: string; device?: string; min?: number } = {}) =>
    formTokenProblem(overrides.token ?? token, overrides.device ?? DEVICE, { now: at, secret: SECRET, minSeconds: overrides.min ?? 3 });

  it("is accepted after the minimal delay, on the same device", () => {
    expect(check(now + 4000)).toBeNull();
  });

  it("refuses a form sent faster than a person fills it", () => {
    expect(check(now + 1000)).toBe("FORM_TOO_FAST");
  });

  it("refuses an old form, a forged token, another device and no token", () => {
    expect(check(now + 3 * 3600 * 1000)).toBe("FORM_EXPIRED");
    expect(check(now + 4000, { token: token.slice(0, -2) + "xx" })).toBe("FORM_TOKEN_INVALID");
    expect(check(now + 4000, { token: `v1.${now - 60_000}.${token.split(".")[2]}` })).toBe("FORM_TOKEN_INVALID");
    expect(check(now + 4000, { device: "ZZZZZZZZZZZZZZZZZZZZ" })).toBe("FORM_TOKEN_INVALID");
    expect(formTokenProblem(undefined, DEVICE, { now, secret: SECRET })).toBe("FORM_TOKEN_MISSING");
    expect(check(now + 4000, { device: "short" })).toBe("FORM_TOKEN_INVALID");
  });
});

describe("the honeypot and disposable addresses", () => {
  it("refuses a filled honeypot, accepts an empty one", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertHoneypot("https://spam.example")).toThrow(HttpError);
    expect(() => assertHoneypot("")).not.toThrow();
    expect(() => assertHoneypot(undefined)).not.toThrow();
  });

  it("recognises disposable domains and their subdomains, with environment overrides", () => {
    expect(isDisposableEmail("a@mailinator.com", {})).toBe(true);
    expect(isDisposableEmail("a@eu.mailinator.com", {})).toBe(true);
    expect(isDisposableEmail("a@YOPMAIL.fr", {})).toBe(true);
    expect(isDisposableEmail("a@gmail.com", {})).toBe(false);
    expect(isDisposableEmail("a@notmailinator.com", {})).toBe(false);
    expect(isDisposableEmail("a@spam.test", { ABUSE_BLOCKED_EMAIL_DOMAINS: "spam.test, other.test" })).toBe(true);
    expect(isDisposableEmail("a@yopmail.com", { ABUSE_ALLOWED_EMAIL_DOMAINS: "yopmail.com" })).toBe(false);
    expect(() => assertEmailDomainAllowed("x@guerrillamail.com")).toThrow(/Disposable/);
  });
});

describe("sign-in back-off and lock-out", () => {
  it("costs nothing for the first mistakes, then doubles up to 15 minutes", () => {
    expect([1, 5, 6, 7, 8, 9, 10, 30].map(lockoutSeconds)).toEqual([0, 0, 30, 60, 120, 240, 480, MAX_LOCK_SECONDS]);
  });

  it("locks an identifier (existing or not) after repeated failures, and a success clears it", async () => {
    useRateLimitStore(memoryStore());
    for (let i = 0; i < 5; i++) {
      await assertLoginAllowed("eve@example.com", "10.0.0.1");
      await recordLoginFailure("eve@example.com");
    }
    await assertLoginAllowed("eve@example.com", "10.0.0.1");
    expect(await recordLoginFailure("EVE@example.com")).toBe(30);
    const locked = await assertLoginAllowed("eve@example.com", "10.0.0.2").catch((e: unknown) => e);
    expect(locked).toBeInstanceOf(RateLimitError);
    expect((locked as RateLimitError).extra.code).toBe("LOGIN_LOCKED");
    expect(Number((locked as RateLimitError).headers["Retry-After"])).toBeGreaterThan(25);
    // Another identifier is not affected.
    await expect(assertLoginAllowed("alex@example.com", "10.0.0.2")).resolves.toBeUndefined();
    await clearLoginFailures("eve@example.com");
    await expect(assertLoginAllowed("eve@example.com", "10.0.0.2")).resolves.toBeUndefined();
  });

  it("caps the attempts of one network", async () => {
    useRateLimitStore(memoryStore());
    for (let i = 0; i < 50; i++) await assertLoginAllowed(`user${i}@example.com`, "10.0.0.66");
    await expect(assertLoginAllowed("someone@example.com", "10.0.0.66")).rejects.toMatchObject({ extra: { code: "LOGIN_RATE_LIMITED" } });
  });
});

describe("the bot challenge (Cloudflare Turnstile)", () => {
  const keys = { ABUSE_BOT_CHALLENGE_SITE_KEY: "1x00000000000000000000AA", ABUSE_BOT_CHALLENGE_SECRET_KEY: "1x0000000000000000000000000000000AA" };
  const answer = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it("is on only when both keys are set, unless turned off", () => {
    expect(challengeConfig({}).active).toBe(false);
    expect(challengeConfig(keys).active).toBe(true);
    expect(challengeConfig({ ...keys, ABUSE_BOT_CHALLENGE: "off" }).active).toBe(false);
    expect(publicChallenge(keys)).toEqual({ provider: "turnstile", siteKey: keys.ABUSE_BOT_CHALLENGE_SITE_KEY });
    expect(publicChallenge({})).toBeNull();
  });

  it("is mandatory in production with ABUSE_BOT_CHALLENGE=required", () => {
    expect(() => challengeConfig({ ABUSE_BOT_CHALLENGE: "required", NODE_ENV: "production" })).toThrow(/ABUSE_BOT_CHALLENGE_SITE_KEY/);
    expect(challengeConfig({ ABUSE_BOT_CHALLENGE: "required", NODE_ENV: "development" }).active).toBe(false);
  });

  it("skips the check when no challenge is configured", async () => {
    expect(await verifyChallenge(undefined, { failMode: "closed", env: {} })).toEqual({ ok: true, skipped: true });
  });

  it("accepts a token Cloudflare confirms, refuses a missing or rejected one", async () => {
    expect(await verifyChallenge("tok", { failMode: "closed", env: keys, fetchImpl: answer({ success: true }) })).toEqual({ ok: true });
    expect(await verifyChallenge(undefined, { failMode: "open", env: keys })).toEqual({ ok: false, reason: "missing" });
    expect(await verifyChallenge("tok", { failMode: "open", env: keys, fetchImpl: answer({ success: false, "error-codes": ["invalid-input-response"] }) })).toEqual({ ok: false, reason: "rejected" });
  });

  it("fails closed for sign-up and open for reading when Cloudflare is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await verifyChallenge("tok", { failMode: "closed", env: keys, fetchImpl: down })).toEqual({ ok: false, reason: "unavailable" });
    expect(await verifyChallenge("tok", { failMode: "open", env: keys, fetchImpl: down })).toEqual({ ok: true, unavailable: true });
    // A bad secret on our side is an outage, not a bot.
    expect(await verifyChallenge("tok", { failMode: "closed", env: keys, fetchImpl: answer({ success: false, "error-codes": ["invalid-input-secret"] }) })).toEqual({ ok: false, reason: "unavailable" });
    expect(await verifyChallenge("tok", { failMode: "closed", env: keys, fetchImpl: answer({}, 500) })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("answers 400 CHALLENGE_FAILED or 503 CHALLENGE_UNAVAILABLE", async () => {
    vi.stubEnv("ABUSE_BOT_CHALLENGE_SITE_KEY", keys.ABUSE_BOT_CHALLENGE_SITE_KEY);
    vi.stubEnv("ABUSE_BOT_CHALLENGE_SECRET_KEY", keys.ABUSE_BOT_CHALLENGE_SECRET_KEY);
    await expect(requireChallenge(undefined, { failMode: "closed" })).rejects.toMatchObject({ status: 400, extra: { code: "CHALLENGE_FAILED" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(requireChallenge("tok", { failMode: "closed" })).rejects.toMatchObject({ status: 503, extra: { code: "CHALLENGE_UNAVAILABLE" } });
  });
});
