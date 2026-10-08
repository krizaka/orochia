import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredProviders, fetchProfile, seal, startAuthorization, suggestUsername, unseal } from "./oauth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const keys = () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "gid");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "gsecret");
  vi.stubEnv("FACEBOOK_APP_ID", "fid");
  vi.stubEnv("FACEBOOK_APP_SECRET", "fsecret");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://dev.orochia.com");
};

describe("sign-in providers", () => {
  it("offers only the providers whose keys are set", () => {
    expect(configuredProviders({})).toEqual([]);
    expect(configuredProviders({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b" })).toEqual(["google"]);
    expect(configuredProviders({ FACEBOOK_APP_ID: "a" })).toEqual([]);
  });

  it("seals state: tampering or expiry is refused", () => {
    const value = seal({ state: "s" }, 60, "secret-0123456789abcdef0123456789abcdef", 1_000_000);
    expect(unseal<{ state: string }>(value, "secret-0123456789abcdef0123456789abcdef", 1_000_000)?.state).toBe("s");
    expect(unseal(value.replace(/.$/, (c) => (c === "A" ? "B" : "A")), "secret-0123456789abcdef0123456789abcdef", 1_000_000)).toBeNull();
    expect(unseal(value, "another-secret-0123456789abcdef0123456789", 1_000_000)).toBeNull();
    expect(unseal(value, "secret-0123456789abcdef0123456789abcdef", 1_000_000 + 61_000)).toBeNull();
  });

  it("builds the consent URL with PKCE, state and this origin's callback; next stays same-site", () => {
    keys();
    const { url, cookie } = startAuthorization("google", "//evil.example");
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("redirect_uri")).toBe("https://dev.orochia.com/api/auth/oauth/google/callback");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
    const saved = unseal<{ state: string; next: string }>(cookie);
    expect(saved?.state).toBe(u.searchParams.get("state"));
    expect(saved?.next).toBe("/");
  });

  it("reads a Google profile (verified address)", async () => {
    keys();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "at" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "g-1", email: "Ana@Example.com", email_verified: true, name: "Ana B", picture: "https://p" }))),
    );
    expect(await fetchProfile("google", "code", "verifier")).toEqual({
      provider: "google",
      providerUserId: "g-1",
      email: "ana@example.com",
      emailVerified: true,
      name: "Ana B",
      avatarUrl: "https://p",
    });
  });

  it("reads a Facebook profile without an address as unverified", async () => {
    keys();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "at" })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: "f-1", name: "Bo" }))),
    );
    const profile = await fetchProfile("facebook", "code", "verifier");
    expect(profile.email).toBeNull();
    expect(profile.emailVerified).toBe(false);
  });

  it("refuses a code the provider does not confirm", async () => {
    keys();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad", { status: 400 })));
    await expect(fetchProfile("google", "code", "verifier")).rejects.toThrow();
  });

  it("suggests a username from the name", () => {
    expect(suggestUsername({ provider: "google", providerUserId: "1", email: null, emailVerified: false, name: "Élodie Martin", avatarUrl: null })).toBe("elodie_martin");
    expect(suggestUsername({ provider: "google", providerUserId: "1", email: "jo@x.com", emailVerified: true, name: null, avatarUrl: null })).toBe("member_jo");
  });
});
