import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError, bunnyStreamConfig, isDemoMode, metricsToken, sessionSecret } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("runtime configuration", () => {
  it("requires every secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("BUNNY_STREAM_API_KEY", "");
    vi.stubEnv("METRICS_AUTH_TOKEN", "");
    expect(() => sessionSecret()).toThrow(ConfigurationError);
    expect(() => bunnyStreamConfig()).toThrow(ConfigurationError);
    expect(() => metricsToken()).toThrow(ConfigurationError);
  });

  it("files uploads in the configured Bunny collection", () => {
    vi.stubEnv("BUNNY_STREAM_COLLECTION_ID", "4380a7c3-565d-4002-89dc-65ceffd11540");
    expect(bunnyStreamConfig().collectionId).toBe("4380a7c3-565d-4002-89dc-65ceffd11540");
    vi.stubEnv("BUNNY_STREAM_COLLECTION_ID", "orochia-dev");
    expect(() => bunnyStreamConfig()).toThrow(ConfigurationError);
    vi.stubEnv("BUNNY_STREAM_COLLECTION_ID", "");
    expect(bunnyStreamConfig().collectionId).toBeUndefined();
  });

  it("refuses a short session secret", () => {
    vi.stubEnv("SESSION_SECRET", "short");
    expect(() => sessionSecret()).toThrow(ConfigurationError);
  });

  it("never enables demo mode in production", () => {
    vi.stubEnv("OROCHIA_DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isDemoMode()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(isDemoMode()).toBe(true);
  });

  it("provides development defaults outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SESSION_SECRET", "");
    expect(sessionSecret().length).toBeGreaterThanOrEqual(32);
  });
});
