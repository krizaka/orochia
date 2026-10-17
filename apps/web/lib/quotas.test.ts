import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfigurationError } from "./env";
import {
  evaluateUpload,
  holdAfterEncoding,
  parseMinutes,
  parsePlans,
  parseSize,
  percentUsed,
  planFor,
  quotaConfig,
  reachedThresholds,
  type UploadContext,
  usageLevel,
} from "./quotas";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

afterEach(() => vi.unstubAllEnvs());

function ctx(overrides: Partial<UploadContext> = {}, env: Record<string, string> = {}): UploadContext {
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return {
    config: quotaConfig(),
    creator: { usage: { bytes: 0, seconds: 0 }, allowance: { bytes: 10 * GB, seconds: 600 * 60 } },
    platform: { usage: { bytes: 0, seconds: 0 } },
    today: { count: 0, oldestAt: null },
    concurrent: 0,
    ...overrides,
  };
}

describe("sizes, minutes and plans", () => {
  it("reads sizes with units, bare numbers in the given unit, and unlimited", () => {
    expect(parseSize("500MB")).toBe(500 * MB);
    expect(parseSize("1.5 TB")).toBe(1.5 * 1024 ** 4);
    expect(parseSize("20")).toBe(20 * GB);
    expect(parseSize("300", "MB")).toBe(300 * MB);
    expect(parseSize("unlimited")).toBeNull();
    expect(() => parseSize("lots")).toThrow();
  });

  it("reads minutes", () => {
    expect(parseMinutes("600")).toBe(36_000);
    expect(parseMinutes("6000min")).toBe(360_000);
    expect(parseMinutes("unlimited")).toBeNull();
    expect(() => parseMinutes("ten")).toThrow();
  });

  it("reads plans, with optional minutes and the unlimited value", () => {
    expect(parsePlans("pro=200GB/6000min, partner=unlimited , small=500MB")).toEqual({
      pro: { bytes: 200 * GB, seconds: 360_000 },
      partner: { bytes: null, seconds: null },
      small: { bytes: 500 * MB, seconds: null },
    });
    expect(() => parsePlans("pro")).toThrow();
    expect(() => parsePlans("bad name=1GB")).toThrow();
  });
});

describe("configuration", () => {
  it("has prudent defaults", () => {
    const config = quotaConfig({ NODE_ENV: "development" });
    expect(config.enabled).toBe(true);
    expect(config.platform.bytes).toBe(100 * GB);
    expect(config.platform.seconds).toBeNull();
    expect(config.plans.default).toEqual({ bytes: 10 * GB, seconds: 36_000 });
    expect(config.plans.unlimited).toEqual({ bytes: null, seconds: null });
    expect(config.adminPlan).toBe("unlimited");
    expect(config.alertThresholds).toEqual([80, 95]);
    expect(config.uploadsPerDay).toBe(50);
    expect(config.concurrentUploads).toBe(3);
  });

  it("refuses ABUSE_QUOTAS=off in production without an explicit decision", () => {
    expect(() => quotaConfig({ NODE_ENV: "production", ABUSE_QUOTAS: "off" })).toThrow(ConfigurationError);
    expect(quotaConfig({ NODE_ENV: "production", ABUSE_QUOTAS: "off", ABUSE_QUOTAS_OFF_CONFIRMED: "true" }).enabled).toBe(false);
    expect(quotaConfig({ NODE_ENV: "development", ABUSE_QUOTAS: "off" }).enabled).toBe(false);
    expect(() => quotaConfig({ ABUSE_QUOTAS: "maybe" })).toThrow(ConfigurationError);
  });

  it("never raises a per-file maximum above the hard limit, and lowers it on request", () => {
    expect(quotaConfig({ ABUSE_QUOTA_VIDEO_MAX_MB: "999999" }).perFile.video.maxBytes).toBe(4 * GB);
    expect(quotaConfig({ ABUSE_QUOTA_VIDEO_MAX_MB: "500" }).perFile.video.maxBytes).toBe(500 * MB);
    expect(quotaConfig({ ABUSE_QUOTA_VIDEO_MAX_MINUTES: "30" }).perFile.video.maxSeconds).toBe(1800);
  });

  it("answers a configuration error for an invalid value or an unknown admin plan", () => {
    expect(() => quotaConfig({ ABUSE_QUOTA_PLATFORM_GB: "a lot" })).toThrow(ConfigurationError);
    expect(() => quotaConfig({ ABUSE_QUOTA_ADMIN_PLAN: "gold" })).toThrow(ConfigurationError);
  });

  it("gives each account its plan: the operator's choice, else its role's default", () => {
    const config = quotaConfig({ ABUSE_QUOTA_PLANS: "pro=200GB" });
    expect(planFor({ role: "CREATOR" }, config).name).toBe("default");
    expect(planFor({ role: "ADMIN" }, config)).toEqual({ name: "unlimited", allowance: { bytes: null, seconds: null } });
    expect(planFor({ role: "CREATOR", storagePlan: "PRO" }, config).allowance.bytes).toBe(200 * GB);
    expect(planFor({ role: "CREATOR", storagePlan: "unlimited" }, config).allowance.bytes).toBeNull();
    // A plan removed from the configuration falls back to the default.
    expect(planFor({ role: "CREATOR", storagePlan: "gone" }, config).name).toBe("default");
  });
});

describe("an upload session, before it is signed", () => {
  it("lets a file that fits through", () => {
    expect(evaluateUpload({ kind: "video", sizeBytes: GB }, ctx())).toEqual({ ok: true });
  });

  it("refuses a file larger than the per-file maximum (413 FILE_TOO_LARGE)", () => {
    const decision = evaluateUpload({ kind: "story", sizeBytes: 300 * MB }, ctx());
    expect(decision).toMatchObject({ ok: false, status: 413, code: "FILE_TOO_LARGE" });
  });

  it("refuses a video longer than allowed when its length is known", () => {
    expect(evaluateUpload({ kind: "story", sizeBytes: MB, durationSeconds: 90 }, ctx())).toMatchObject({ code: "VIDEO_TOO_LONG" });
    expect(evaluateUpload({ kind: "story", sizeBytes: MB, durationSeconds: 61 }, ctx())).toEqual({ ok: true });
  });

  it("refuses a file that does not fit the creator's plan (413 CREATOR_STORAGE_FULL)", () => {
    const decision = evaluateUpload({ kind: "video", sizeBytes: 2 * GB }, ctx({ creator: { usage: { bytes: 9 * GB, seconds: 0 }, allowance: { bytes: 10 * GB, seconds: null } } }));
    expect(decision).toMatchObject({ ok: false, status: 413, code: "CREATOR_STORAGE_FULL" });
  });

  it("refuses when the plan's video time is spent", () => {
    const decision = evaluateUpload({ kind: "video", sizeBytes: MB, durationSeconds: 120 }, ctx({ creator: { usage: { bytes: 0, seconds: 599 * 60 }, allowance: { bytes: null, seconds: 600 * 60 } } }));
    expect(decision).toMatchObject({ code: "CREATOR_MINUTES_FULL" });
  });

  it("lets an unlimited plan through whatever it keeps — but not past the platform's cap", () => {
    const unlimited = { usage: { bytes: 900 * GB, seconds: 10 ** 7 }, allowance: { bytes: null, seconds: null } };
    expect(evaluateUpload({ kind: "video", sizeBytes: 3 * GB }, ctx({ creator: unlimited }))).toEqual({ ok: true });
    const full = ctx({ creator: unlimited, platform: { usage: { bytes: 99.5 * GB, seconds: 0 } } });
    expect(evaluateUpload({ kind: "video", sizeBytes: GB }, full)).toMatchObject({ ok: false, status: 413, code: "PLATFORM_STORAGE_FULL" });
  });

  it("checks the platform before the creator (the operator's problem is said first)", () => {
    const both = ctx({ creator: { usage: { bytes: 10 * GB, seconds: 0 }, allowance: { bytes: 10 * GB, seconds: null } }, platform: { usage: { bytes: 100 * GB, seconds: 0 } } });
    expect(evaluateUpload({ kind: "video", sizeBytes: MB }, both)).toMatchObject({ code: "PLATFORM_STORAGE_FULL" });
  });

  it("caps the uploads of a day with a Retry-After until the oldest one is a day old (429)", () => {
    const now = new Date("2026-10-11T12:00:00Z");
    const decision = evaluateUpload({ kind: "video", sizeBytes: MB }, ctx({ now, today: { count: 50, oldestAt: new Date("2026-10-11T02:00:00Z") } }));
    expect(decision).toMatchObject({ ok: false, status: 429, code: "UPLOADS_PER_DAY", retryAfterSeconds: 14 * 3600 });
  });

  it("caps the uploads in progress (429 CONCURRENT_UPLOADS)", () => {
    expect(evaluateUpload({ kind: "draft", sizeBytes: MB }, ctx({ concurrent: 3 }))).toMatchObject({ status: 429, code: "CONCURRENT_UPLOADS", retryAfterSeconds: 60 });
  });

  it("lets everything through when the limits are off", () => {
    const off = ctx({ creator: { usage: { bytes: 99 * GB, seconds: 0 }, allowance: { bytes: GB, seconds: null } }, concurrent: 99 }, { ABUSE_QUOTAS: "off" });
    expect(evaluateUpload({ kind: "video", sizeBytes: 3 * GB }, off)).toEqual({ ok: true });
  });
});

describe("after encoding", () => {
  const config = quotaConfig({});
  it("holds a file whose real size put the creator over the plan, or the platform over its cap", () => {
    expect(holdAfterEncoding({ config, creator: { usage: { bytes: 11 * GB, seconds: 0 }, allowance: { bytes: 10 * GB, seconds: null } }, platform: { usage: { bytes: 0, seconds: 0 } } })).toBe("CREATOR");
    expect(holdAfterEncoding({ config, creator: { usage: { bytes: GB, seconds: 0 }, allowance: { bytes: null, seconds: null } }, platform: { usage: { bytes: 101 * GB, seconds: 0 } } })).toBe("PLATFORM");
    expect(holdAfterEncoding({ config, creator: { usage: { bytes: 10 * GB, seconds: 0 }, allowance: { bytes: 10 * GB, seconds: null } }, platform: { usage: { bytes: 10 * GB, seconds: 0 } } })).toBeNull();
  });
});

describe("levels and alerts", () => {
  it("says how full", () => {
    expect(percentUsed(5, 10)).toBe(50);
    expect(percentUsed(5, null)).toBeNull();
    expect(usageLevel(79, 100)).toBe("ok");
    expect(usageLevel(80, 100)).toBe("warning");
    expect(usageLevel(96, 100)).toBe("critical");
    expect(usageLevel(100, 100)).toBe("full");
    expect(usageLevel(1, null)).toBe("unlimited");
  });

  it("names the alert thresholds reached", () => {
    expect(reachedThresholds(70, 100, [80, 95])).toEqual([]);
    expect(reachedThresholds(85, 100, [80, 95])).toEqual([80]);
    expect(reachedThresholds(97, 100, [80, 95])).toEqual([80, 95]);
    expect(reachedThresholds(97, null, [80, 95])).toEqual([]);
  });
});
