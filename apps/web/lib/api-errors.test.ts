import { describe, expect, it } from "vitest";

import { apiErrorMessage, formatBytes, formatWait } from "./api-errors";
import { toolsFor } from "./i18n";

const { t } = toolsFor("en");

const GB = 1024 ** 3;

describe("what the UI says for a refusal", () => {
  it("explains a full plan with the space left", () => {
    const message = apiErrorMessage(t, { code: "CREATOR_STORAGE_FULL", error: "Not enough space", quota: { usedBytes: 9.5 * GB, limitBytes: 10 * GB } }, "failed");
    expect(message).toContain("512 MB");
    expect(message).toContain("10 GB");
    expect(message).toMatch(/Delete drafts or old videos/);
  });

  it("says how long to wait, from the body or Retry-After", () => {
    expect(apiErrorMessage(t, { code: "UPLOADS_PER_DAY" }, "failed", { retryAfter: "7200" })).toContain("2 h");
    expect(apiErrorMessage(t, { code: "LOGIN_LOCKED", retryAfterSeconds: 30 }, "failed")).toContain("30 s");
    expect(formatWait(t, 90)).toBe("2 min");
  });

  it("says the platform is paused, in its own words", () => {
    expect(apiErrorMessage(t, { code: "PLATFORM_STORAGE_FULL", error: "x" }, "failed")).toMatch(/paused/);
  });

  it("falls back to the API's message, then to the default", () => {
    expect(apiErrorMessage(t, { code: "SOMETHING_NEW", error: "Server words" }, "failed")).toBe("Server words");
    expect(apiErrorMessage(t, null, "failed")).toBe("failed");
  });

  it("says it in French, with Québec's units", () => {
    const fr = toolsFor("fr").t;
    const message = apiErrorMessage(fr, { code: "CREATOR_STORAGE_FULL", quota: { usedBytes: 9.5 * GB, limitBytes: 10 * GB } }, "échec");
    expect(message).toContain("Mo");
    expect(message).toContain("Go");
    expect(message).not.toMatch(/\bMB\b|\bGB\b/);
    expect(formatWait(fr, 90).replace(/\s/g, " ")).toBe("2 min");
  });

  it("formats sizes", () => {
    expect(formatBytes(t, 1.5 * GB)).toBe("1.5 GB");
    expect(formatBytes(t, 820 * 1024 ** 2)).toBe("820 MB");
  });
});
