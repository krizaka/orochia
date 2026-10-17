import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * krizaka/orochia#127 — a native app's bearer token decides the session; a cookie never overrides it.
 *
 * On iOS the native `fetch` keeps any cookie a route sets in the system cookie jar, and that jar outlives the app's
 * sign-out. When a request carried both a stale cookie (account A) and a fresh bearer (account B), the server used to
 * answer A: on a shared phone, the next person signed in and landed in the previous person's account.
 */
const request = vi.hoisted(() => ({ cookie: undefined as string | undefined, authorization: null as string | null }));
const revoked = vi.hoisted(() => new Set<string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "orochia_session" && request.cookie ? { value: request.cookie } : undefined) }),
  headers: async () => new Headers(request.authorization ? { authorization: request.authorization } : {}),
}));
vi.mock("./session-revocation", () => ({
  isSessionRevoked: async (token: string) => revoked.has(token),
  revokeSession: async (token: string) => void revoked.add(token),
  sessionsEndedByOperator: async () => false,
  issuedBefore: () => false,
}));
vi.mock("./account-tokens", () => ({ consumeToken: async () => "jordan", markEmailVerified: async () => undefined }));
vi.mock("./rate-limit", () => ({ enforceRateLimit: async () => undefined }));

import { NextRequest } from "next/server";

import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";

import { getSession, sessionTransport, type SessionUser,signSessionToken } from "./auth";

const SECRET = "test-secret-0123456789-0123456789-abcdef";
const jordan: SessionUser = { id: "jordan", username: "jordan_0127", email: "jordan@example.com", role: "MEMBER", isAgeVerified: true, emailVerified: false };
const alex: SessionUser = { id: "alex", username: "alexcarter", email: "alex@example.com", role: "MEMBER", isAgeVerified: true, emailVerified: true };

beforeEach(() => {
  vi.stubEnv("AUTH_SESSION_SECRET", SECRET);
  request.cookie = undefined;
  request.authorization = null;
  revoked.clear();
});
afterEach(() => vi.unstubAllEnvs());

describe("which session a request carries", () => {
  it("is the bearer's when a stale cookie of another account comes along (the #127 sequence)", async () => {
    request.cookie = signSessionToken(jordan);
    request.authorization = `Bearer ${signSessionToken(alex)}`;
    expect((await getSession())?.username).toBe("alexcarter");
    expect(await sessionTransport()).toBe("bearer");
  });

  it("is none when the bearer is forged, expired or malformed — never the cookie's instead", async () => {
    request.cookie = signSessionToken(jordan);
    request.authorization = `Bearer ${signSessionToken(alex, "another-secret-0123456789-0123456789-xx")}`;
    expect(await getSession()).toBeNull();
    request.authorization = "Bearer not-a-session";
    expect(await getSession()).toBeNull();
    expect(await sessionTransport()).toBe("bearer");
  });

  it("is the browser's cookie when no bearer is sent (the web is unchanged)", async () => {
    request.cookie = signSessionToken(jordan);
    expect((await getSession())?.username).toBe("jordan_0127");
    expect(await sessionTransport()).toBe("cookie");
  });

  it("is none once its token was signed out", async () => {
    const token = signSessionToken(alex);
    request.authorization = `Bearer ${token}`;
    expect((await getSession())?.username).toBe("alexcarter");
    revoked.add(token);
    expect(await getSession()).toBeNull();
  });
});

describe("POST /api/auth/verify-email from the native app", () => {
  const verify = () =>
    verifyEmail(new NextRequest("http://localhost/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token: "one-time" }) }));

  it("sets no session cookie for a bearer session — it answers the refreshed token instead", async () => {
    request.authorization = `Bearer ${signSessionToken(jordan)}`;
    const res = await verify();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    const body = (await res.json()) as { token?: string };
    expect(body.token).toBeTruthy();
    request.authorization = `Bearer ${body.token}`;
    expect((await getSession())?.emailVerified).toBe(true);
  });

  it("still refreshes the browser's cookie", async () => {
    request.cookie = signSessionToken(jordan);
    const res = await verify();
    expect(res.headers.get("set-cookie")).toContain("orochia_session=");
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the bearer token it was sent with, and sets no session cookie", async () => {
    const token = signSessionToken(alex);
    request.authorization = `Bearer ${token}`;
    const res = await logout();
    expect(res.status).toBe(200);
    expect(revoked.has(token)).toBe(true);
    expect(await getSession()).toBeNull();
  });

  it("revokes the browser's cookie token and clears the cookie", async () => {
    const token = signSessionToken(jordan);
    request.cookie = token;
    const res = await logout();
    expect(revoked.has(token)).toBe(true);
    expect(res.headers.get("set-cookie")).toMatch(/orochia_session=;.*Max-Age=0/i);
  });
});

describe("session tokens of one account", () => {
  it("are distinct, even signed in the same second — signing one out leaves the other", async () => {
    const now = Date.now();
    const app = signSessionToken(alex, SECRET, now);
    const web = signSessionToken(alex, SECRET, now);
    expect(app).not.toBe(web);
    revoked.add(app);
    request.cookie = web;
    expect((await getSession())?.username).toBe("alexcarter");
  });
});
