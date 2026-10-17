import { afterEach, describe, expect, it, vi } from "vitest";

import { bunnyStreamConfig, ConfigurationError, isDemoMode, metricsToken, sessionSecret } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("runtime configuration", () => {
  it("requires every secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SESSION_SECRET", "");
    vi.stubEnv("MEDIA_STREAM_API_KEY", "");
    vi.stubEnv("OBSERVABILITY_METRICS_TOKEN", "");
    expect(() => sessionSecret()).toThrow(ConfigurationError);
    expect(() => bunnyStreamConfig()).toThrow(ConfigurationError);
    expect(() => metricsToken()).toThrow(ConfigurationError);
  });

  it("files uploads in the configured Bunny collection", () => {
    vi.stubEnv("MEDIA_STREAM_COLLECTION_ID", "4380a7c3-565d-4002-89dc-65ceffd11540");
    expect(bunnyStreamConfig().collectionId).toBe("4380a7c3-565d-4002-89dc-65ceffd11540");
    vi.stubEnv("MEDIA_STREAM_COLLECTION_ID", "orochia-dev");
    expect(() => bunnyStreamConfig()).toThrow(ConfigurationError);
    vi.stubEnv("MEDIA_STREAM_COLLECTION_ID", "");
    expect(bunnyStreamConfig().collectionId).toBeUndefined();
  });

  it("refuses a short session secret", () => {
    vi.stubEnv("AUTH_SESSION_SECRET", "short");
    expect(() => sessionSecret()).toThrow(ConfigurationError);
  });

  it("never enables demo mode in production", () => {
    vi.stubEnv("APP_DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isDemoMode()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(isDemoMode()).toBe(true);
  });

  it("provides development defaults outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AUTH_SESSION_SECRET", "");
    expect(sessionSecret().length).toBeGreaterThanOrEqual(32);
  });
});

describe("requireBunnyStream", () => {
  it("names what to configure when a developer has no Bunny library", async () => {
    const { requireBunnyStream } = await import("./env");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MEDIA_STREAM_API_KEY", "");
    expect(() => requireBunnyStream()).toThrow(/MEDIA_STREAM_API_KEY is not set: .*Video features locally/);
    vi.stubEnv("MEDIA_STREAM_API_KEY", "a-key");
    expect(requireBunnyStream().apiKey).toBe("a-key");
  });
});

describe("ENV_VARS — every variable named by its bounded context (krizaka/.github#46)", () => {
  // The runtime's and the framework's own variables, and the tooling's (scripts, not the app).
  const FRAMEWORK = new Set(["NODE_ENV", "PORT", "HOSTNAME", "NEXT_PHASE", "NEXT_RUNTIME", "NEXT_PUBLIC_APP_VERSION", "NEXT_PUBLIC_APP_COMMIT_SHA", "CI", "GITHUB_TOKEN"]);
  const TOOLING = new Set(["APP_URL", "APP_DEMO_SEED", "APP_DEMO_PORT", "DATABASE_DEMO_URL", "DATABASE_MIGRATIONS_DIR", "DATABASE_RECONNECT_IT", "SCREENSHOTS_LOGIN", "SCREENSHOTS_PASSWORD", "TOUR_LOCAL_MEDIA", "OUT", "REALTIME_IT", "EXPLORER_IT", "FEED_IT"]);
  const CONTEXT = /^(NEXT_PUBLIC_)?(APP|DATABASE|AUTH|MEDIA|MAIL|PUSH|PAYMENTS|REALTIME|ABUSE|OBSERVABILITY|AI|OPERATOR)_[A-Z0-9_]+$/;
  const VENDOR_OR_PRODUCT = /^(NEXT_PUBLIC_|EXPO_PUBLIC_)?(OROCHIA|KRIZAKA|BUNNY|MAILGUN|RESEND|STRIPE|CCBILL|SEGPAY|NOWPAYMENTS|TURNSTILE|CLOUDFLARE|EXPO|GOOGLE|FACEBOOK|VERCEL|REDIS|DO|DIGITALOCEAN)_/;

  async function sources() {
    const { execSync } = await import("node:child_process");
    const fs = await import("node:fs");
    const path = await import("node:path");
    const root = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
    const files = execSync("git ls-files", { cwd: root, encoding: "utf8" }).split("\n").filter((f) => /\.(ts|tsx|mjs|cjs|js)$/.test(f) && !f.endsWith("env.test.ts"));
    return { root, fs, path, files };
  }

  it("names every variable <CONTEXT>_<THING>, never after a product or a vendor", async () => {
    const { ENV_VARS } = await import("./env");
    for (const e of ENV_VARS) {
      expect(e.name, e.name).toMatch(CONTEXT);
      expect(e.name, e.name).not.toMatch(VENDOR_OR_PRODUCT);
      expect(e.name.startsWith(`${e.context}_`) || e.name.startsWith(`NEXT_PUBLIC_${e.context}_`), `${e.name} is in ${e.context}`).toBe(true);
    }
    expect(new Set(ENV_VARS.map((e) => e.name)).size).toBe(ENV_VARS.length);
  });

  it("declares every variable the code, .env.example and the App Platform specs use", async () => {
    const { ENV_VARS } = await import("./env");
    const declared = new Set(ENV_VARS.map((e) => e.name));
    const { root, fs, path, files } = await sources();
    const used = new Map<string, string>();
    for (const file of files) {
      const src = fs.readFileSync(path.join(root, file), "utf8");
      for (const m of src.matchAll(/\b(?:process\.env|env)(?:\.|\[["'])([A-Z][A-Z0-9_]+)/g)) used.set(m[1], file);
    }
    for (const m of fs.readFileSync(path.join(root, ".env.example"), "utf8").matchAll(/^#?\s?([A-Z][A-Z0-9_]+)=/gm)) used.set(m[1], ".env.example");
    for (const spec of ["deploy/digitalocean/app-spec.dev.yaml", "deploy/digitalocean/app-spec.production.yaml"]) {
      for (const m of fs.readFileSync(path.join(root, spec), "utf8").matchAll(/key: ([A-Z][A-Z0-9_]+)/g)) used.set(m[1], spec);
    }
    const undeclared = [...used].filter(([name]) => !declared.has(name) && !FRAMEWORK.has(name) && !TOOLING.has(name)).map(([n, f]) => `${n} (${f})`);
    expect(undeclared.join(", ")).toBe("");
    for (const name of TOOLING) if (!["SCREENSHOTS_LOGIN", "SCREENSHOTS_PASSWORD", "TOUR_LOCAL_MEDIA", "OUT", "REALTIME_IT", "EXPLORER_IT", "FEED_IT"].includes(name)) expect(name).toMatch(CONTEXT);
  });

  it("lists every declared variable in .env.example", async () => {
    const { ENV_VARS } = await import("./env");
    const { root, fs, path } = await sources();
    const example = fs.readFileSync(path.join(root, ".env.example"), "utf8");
    const missing = ENV_VARS.filter((e) => !e.build && !new RegExp(`^#?\\s?${e.name}=`, "m").test(example)).map((e) => e.name);
    expect(missing).toEqual([]);
  });
});

describe("checkEnv / assertEnv — fail-closed in production", () => {
  const complete = {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://dev.orochia.com",
    DATABASE_URL: "postgresql://u:p@db:5432/orochia",
    AUTH_SESSION_SECRET: "s".repeat(32),
    MEDIA_STREAM_API_KEY: "k",
    MEDIA_STREAM_LIBRARY_ID: "42",
    MEDIA_STREAM_HOSTNAME: "vz-1.b-cdn.net",
    MEDIA_STREAM_TOKEN_AUTH_KEY: "t",
    MEDIA_STREAM_WEBHOOK_SECRET: "w",
    MEDIA_STORAGE_PROVIDER: "bunny",
    MEDIA_STORAGE_API_KEY: "a",
    MEDIA_STORAGE_ZONE: "z",
    MEDIA_CDN_HOSTNAME: "cdn.example.com",
    PAYMENTS_PAYOUT_ENCRYPTION_KEY: "p".repeat(32),
    OBSERVABILITY_METRICS_TOKEN: "m",
  };

  it("accepts a complete production environment", async () => {
    const { checkEnv } = await import("./env");
    expect(checkEnv(complete)).toEqual([]);
  });

  it("names every missing or malformed variable, never a value", async () => {
    const { checkEnv } = await import("./env");
    const problems = checkEnv({ ...complete, AUTH_SESSION_SECRET: "", MEDIA_STREAM_LIBRARY_ID: "abc", MAIL_PROVIDER: "postmark", REALTIME_BUS: "redis" });
    expect(problems.some((p) => p.startsWith("AUTH_SESSION_SECRET is required"))).toBe(true);
    expect(problems.some((p) => p.startsWith("MEDIA_STREAM_LIBRARY_ID"))).toBe(true);
    expect(problems.some((p) => p.startsWith("MAIL_PROVIDER"))).toBe(true);
    expect(problems).toContain("REALTIME_REDIS_URL is required when REALTIME_BUS=redis");
    expect(problems.join(" ")).not.toContain("abc");
  });

  it("refuses local storage in production, accepts it in development", async () => {
    const { checkEnv } = await import("./env");
    expect(checkEnv({ ...complete, MEDIA_STORAGE_PROVIDER: "local" })).toContain("MEDIA_STORAGE_PROVIDER must be bunny in production");
    expect(checkEnv({ NODE_ENV: "development" })).toEqual([]);
  });

  it("stops a deployed production server, only warns a local one", async () => {
    const { assertEnv, ConfigurationError } = await import("./env");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertEnv({ NODE_ENV: "production" }, "dev")).toThrow(ConfigurationError);
    expect(() => assertEnv({ NODE_ENV: "production" }, undefined)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    expect(() => assertEnv(complete, "production")).not.toThrow();
  });
});
