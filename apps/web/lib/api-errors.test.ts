import { describe, expect, it } from "vitest";
import { apiErrorMessage, formatBytes, formatWait } from "./api-errors";

const GB = 1024 ** 3;

describe("what the UI says for a refusal", () => {
  it("explains a full plan with the space left", () => {
    const message = apiErrorMessage({ code: "CREATOR_STORAGE_FULL", error: "Not enough space", quota: { usedBytes: 9.5 * GB, limitBytes: 10 * GB } }, "failed");
    expect(message).toContain("512 MB");
    expect(message).toContain("10.0 GB");
    expect(message).toMatch(/Delete drafts or old videos/);
  });

  it("says how long to wait, from the body or Retry-After", () => {
    expect(apiErrorMessage({ code: "UPLOADS_PER_DAY" }, "failed", { retryAfter: "7200" })).toContain("2 h");
    expect(apiErrorMessage({ code: "LOGIN_LOCKED", retryAfterSeconds: 30 }, "failed")).toContain("30 s");
    expect(formatWait(90)).toBe("2 min");
  });

  it("says the platform is paused, in its own words", () => {
    expect(apiErrorMessage({ code: "PLATFORM_STORAGE_FULL", error: "x" }, "failed")).toMatch(/paused/);
  });

  it("falls back to the API's message, then to the default", () => {
    expect(apiErrorMessage({ code: "SOMETHING_NEW", error: "Server words" }, "failed")).toBe("Server words");
    expect(apiErrorMessage(null, "failed")).toBe("failed");
  });

  it("formats sizes", () => {
    expect(formatBytes(1.5 * GB)).toBe("1.5 GB");
    expect(formatBytes(820 * 1024 ** 2)).toBe("820 MB");
  });
});
