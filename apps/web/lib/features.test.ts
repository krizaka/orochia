import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Sign-up is a deployment switch (`AUTH_SIGNUP_ENABLED`, default false): a development deployment stays closed to
 * newcomers while existing accounts still sign in. The routes run for real; the database is not touched.
 */
vi.mock("@orochia/db", () => ({ db: {}, users: {}, profiles: {}, hashPassword: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));

import { POST as completeOauth } from "@/app/api/auth/oauth/complete/route";
import { GET as authConfig } from "@/app/api/auth/providers/route";
import { GET as openForm, POST as register } from "@/app/api/auth/register/route";
import { GET as versionRoute } from "@/app/api/version/route";

import { signupEnabled } from "./features";

afterEach(() => vi.unstubAllEnvs());

describe("signupEnabled", () => {
  it("is off unless the variable says true", () => {
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "");
    expect(signupEnabled()).toBe(false);
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "false");
    expect(signupEnabled()).toBe(false);
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "yes");
    expect(signupEnabled()).toBe(false);
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "true");
    expect(signupEnabled()).toBe(true);
  });
});

describe("sign-up closed", () => {
  it("POST /api/auth/register answers 403 signup_disabled", async () => {
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "false");
    const res = await register(new NextRequest("http://localhost/api/auth/register", { method: "POST", body: "{}" }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("signup_disabled");
  });

  it("GET /api/auth/register (the form token) is refused the same way", async () => {
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "false");
    const res = await openForm(new NextRequest("http://localhost/api/auth/register"));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("signup_disabled");
  });

  it("a new Google / Facebook account is refused too", async () => {
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "false");
    const res = await completeOauth(new NextRequest("http://localhost/api/auth/oauth/complete", { method: "POST", body: "{}" }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("signup_disabled");
  });

  it("the public config the apps read says so (signupEnabled)", async () => {
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "false");
    expect(((await (await authConfig()).json()) as { signupEnabled: boolean }).signupEnabled).toBe(false);
    vi.stubEnv("AUTH_SIGNUP_ENABLED", "true");
    expect(((await (await authConfig()).json()) as { signupEnabled: boolean }).signupEnabled).toBe(true);
  });
});

describe("GET /api/version", () => {
  it("answers the build: version and short commit", async () => {
    const body = (await (await versionRoute()).json()) as { version: string; sha: string | null; env: string };
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(["local", "dev", "staging", "production"]).toContain(body.env);
    expect(body).toHaveProperty("sha");
  });
});
