import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const orochia = vi.fn(async (_path: string, _init?: RequestInit) => ({}));
const audit = vi.fn(async () => undefined);
vi.mock("@/console/lib/orochia", () => ({
  orochia: (path: string, init?: RequestInit) => orochia(path, init),
  ApiError: class ApiError extends Error {
    constructor(
      readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/console/lib/account", () => ({ audit: (...args: unknown[]) => (audit as (...a: unknown[]) => Promise<void>)(...args), currentAdmin: async () => ({ email: "ana@example.com", displayName: "Ana" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));

import { AppVersionForm, type AppVersionRecord } from "@/console/components/AppVersionForm";

import { publishAppVersion, rollbackAppVersion } from "./actions";

const record: AppVersionRecord = {
  platform: "ios",
  minSupportedVersion: "1.2.0",
  latestVersion: "1.4.0",
  updateOverride: null,
  storeUrl: "https://apps.apple.com/app/id1",
  maintenanceOn: false,
  maintenanceMessage: { en: "Back soon" },
  message: { en: "Update", fr: "Mettez à jour" },
  contractMin: 1,
  contractMax: 2,
  contractSunset: "2026-12-31",
  flags: { voice: true },
  revision: 3,
  updatedAt: "2026-10-16T12:00:00Z",
  updatedBy: "ana@example.com",
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const filled = {
  platform: "ios",
  minSupportedVersion: "1.2.0",
  latestVersion: "1.4.0",
  updateOverride: "",
  storeUrl: "https://apps.apple.com/app/id1",
  "message.en": "Update",
  "message.fr": "",
  "maintenanceMessage.en": "",
  "maintenanceMessage.fr": "",
  contractMin: "1",
  contractMax: "2",
  contractSunset: "2026-12-31",
  flags: '{"voice":true}',
  reason: "ship 1.4",
};

beforeEach(() => {
  orochia.mockClear();
  audit.mockClear();
});

describe("app versions (krizaka/.github#75)", () => {
  it("publishes the parameters to Orochia's admin API, with the reason, and records the decision", async () => {
    const state = await publishAppVersion(null, form({ ...filled, maintenanceOn: "on" }));
    expect(state).toMatchObject({ ok: true, message: "ios published" });
    const [path, init] = orochia.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/admin/app-config/ios");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      minSupportedVersion: "1.2.0",
      latestVersion: "1.4.0",
      updateOverride: null,
      storeUrl: "https://apps.apple.com/app/id1",
      maintenanceOn: true,
      maintenanceMessage: {},
      message: { en: "Update" },
      contractMin: 1,
      contractMax: 2,
      contractSunset: "2026-12-31",
      flags: { voice: true },
      reason: "ship 1.4",
    });
    expect(audit).toHaveBeenCalledWith("app versions → ios", "ios", "ok", "ship 1.4", { actor: "ana@example.com", requestIds: [] });
  });

  it("refuses flags that are not JSON, before calling Orochia", async () => {
    const state = await publishAppVersion(null, form({ ...filled, flags: "voice: true" }));
    expect(state).toMatchObject({ ok: false, error: expect.stringContaining("JSON") });
    expect(orochia).not.toHaveBeenCalled();
  });

  it("shows Orochia's refusal in place and records it", async () => {
    const { ApiError } = await import("@/console/lib/orochia");
    orochia.mockRejectedValueOnce(new ApiError(400, "latestVersion is older than minSupportedVersion"));
    const state = await publishAppVersion(null, form({ ...filled, minSupportedVersion: "9.0.0" }));
    expect(state).toMatchObject({ ok: false, error: "latestVersion is older than minSupportedVersion" });
    expect(audit).toHaveBeenCalledWith("app versions → ios", "ios", "refused", "latestVersion is older than minSupportedVersion", { actor: "ana@example.com", requestIds: [] });
  });

  it("restores an earlier revision with its reason", async () => {
    const state = await rollbackAppVersion(null, form({ platform: "android", revision: "2", reason: "3 was too eager" }));
    expect(state).toMatchObject({ ok: true, message: "android restored to revision 2" });
    const [path, init] = orochia.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/api/admin/app-config/android/rollback");
    expect(JSON.parse(String(init.body))).toEqual({ revision: 2, reason: "3 was too eager" });
  });

  it("shows every parameter of the platform, labelled, with the reason required", () => {
    const html = renderToStaticMarkup(<AppVersionForm record={record} action={publishAppVersion} />);
    for (const label of ["Minimum supported version", "Latest version", "Update mode", "Store page", "Update message (English)", "Message de mise à jour (français)", "Maintenance message (English)", "Oldest contract served", "Newest contract", "Sunset of the older ones", "Feature flags (JSON)", "Reason"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('value="1.2.0"');
    expect(html).toContain("revision 3");
    expect(html).toMatch(/name="reason"[^>]*required|required=""[^>]*name="reason"/);
  });
});
