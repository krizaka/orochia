import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Sign-up from the native app (krizaka/orochia-mobile): the same rules as the web form, carried without a browser —
 * the device id comes in a header instead of a cookie, the session comes back as a token instead of a cookie, and the
 * bot challenge is a page the app shows in a WebView. The routes run for real; the database is not touched here
 * (the full flow is in e2e/scenarios.mjs).
 */
vi.mock("@orochia/db", () => ({ db: {}, users: {}, profiles: {}, hashPassword: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import { GET as openForm } from "@/app/api/auth/register/route";
import { GET as challengePage } from "@/app/auth/native-challenge/route";
import { DEVICE_HEADER, formTokenProblem, signupDeviceId } from "./abuse/signup-guard";

const DEVICE = "AppInstall_0123456789abcdef";
const SECRET = "test-secret-0123456789-0123456789-abcdef";

beforeEach(() => vi.stubEnv("AUTH_SIGNUP_ENABLED", "true"));
afterEach(() => vi.unstubAllEnvs());

describe("the device a sign-up comes from", () => {
  it("is the app's header when it sends a valid one, else the browser's cookie", () => {
    expect(signupDeviceId(new Headers({ [DEVICE_HEADER]: DEVICE }), "CookieDevice0123456789")).toBe(DEVICE);
    expect(signupDeviceId(new Headers(), "CookieDevice0123456789")).toBe("CookieDevice0123456789");
    expect(signupDeviceId(new Headers({ [DEVICE_HEADER]: "short" }), undefined)).toBeUndefined();
    expect(signupDeviceId(new Headers({ [DEVICE_HEADER]: "not/a device id at all" }), "CookieDevice0123456789")).toBe("CookieDevice0123456789");
  });
});

describe("GET /api/auth/register?client=native", () => {
  it("answers a form token bound to the app's device id, and sets no cookie", async () => {
    vi.stubEnv("AUTH_SESSION_SECRET", SECRET);
    const res = await openForm(new NextRequest("http://localhost/api/auth/register?client=native", { headers: { [DEVICE_HEADER]: DEVICE } }));
    const body = (await res.json()) as { formToken: string; challenge: unknown };
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    const issued = Number(body.formToken.split(".")[1]);
    expect(formTokenProblem(body.formToken, DEVICE, { now: issued + 5000, secret: SECRET, minSeconds: 3 })).toBeNull();
    expect(formTokenProblem(body.formToken, "AnotherDevice_0123456789", { now: issued + 5000, secret: SECRET, minSeconds: 3 })).toBe("FORM_TOKEN_INVALID");
  });

  it("refuses an app that sends no device id (400 DEVICE_ID_INVALID)", async () => {
    const res = await openForm(new NextRequest("http://localhost/api/auth/register?client=native"));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("DEVICE_ID_INVALID");
  });

  it("still gives a browser its device cookie", async () => {
    const res = await openForm(new NextRequest("http://localhost/api/auth/register"));
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("orochia_device=");
  });
});

describe("the native bot-challenge page", () => {
  it("says there is no challenge when none is configured", async () => {
    vi.stubEnv("ABUSE_BOT_CHALLENGE_SITE_KEY", "");
    vi.stubEnv("ABUSE_BOT_CHALLENGE_SECRET_KEY", "");
    const html = await challengePage(new NextRequest("http://localhost/auth/native-challenge")).text();
    expect(html).toContain("var config = null;");
    expect(html).not.toContain("challenges.cloudflare.com");
  });

  it("renders the Turnstile widget with the public site key and the app's theme — never the secret", async () => {
    vi.stubEnv("ABUSE_BOT_CHALLENGE", "auto");
    vi.stubEnv("ABUSE_BOT_CHALLENGE_SITE_KEY", "1x00000000000000000000AA");
    vi.stubEnv("ABUSE_BOT_CHALLENGE_SECRET_KEY", "1x0000000000000000000000000000000AA");
    const res = challengePage(new NextRequest("http://localhost/auth/native-challenge?theme=light"));
    const html = await res.text();
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('"siteKey":"1x00000000000000000000AA"');
    expect(html).toContain('"theme":"light"');
    expect(html).toContain("challenges.cloudflare.com/turnstile/v0/api.js");
    expect(html).toContain("ReactNativeWebView");
    expect(html).not.toContain("1x0000000000000000000000000000000AA");
  });
});
