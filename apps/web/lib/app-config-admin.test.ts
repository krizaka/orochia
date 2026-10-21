import { defaultRecord } from "@krizaka/app-config";
import { describe, expect, it } from "vitest";

import { nextRevision, parsePublish } from "./app-config-admin";

// Dev preview `admin.operator-tasks`: the operator publishes the app-version parameters (draft -> publish -> audit ->
// rollback) through /api/admin/app-config. The rules are pure: a body is validated, a publish is the next revision, a
// rollback re-publishes an earlier revision as a new one — never rewrites history.
const body = { minSupportedVersion: "1.0.0", latestVersion: "1.2.0", updateOverride: null, storeUrl: null, maintenanceOn: false, maintenanceMessage: {}, message: { en: "Update available" }, contractMin: 1, contractMax: 2, contractSunset: null, flags: { voice: true }, reason: "ship 1.2" };

describe("parsePublish", () => {
  it("accepts a complete body", () => {
    const parsed = parsePublish("ios", body);
    expect(parsed.ok).toBe(true);
  });
  it("refuses an unknown platform, a missing reason and a latest older than the minimum", () => {
    expect(parsePublish("amiga", body)).toMatchObject({ ok: false, status: 404 });
    expect(parsePublish("ios", { ...body, reason: " " })).toMatchObject({ ok: false, status: 400 });
    expect(parsePublish("ios", { ...body, minSupportedVersion: "2.0.0", latestVersion: "1.0.0" })).toMatchObject({ ok: false, status: 400 });
  });
  it("refuses flags that are not a flat object of booleans, numbers or texts", () => {
    expect(parsePublish("ios", { ...body, flags: { nested: { a: 1 } } })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("nextRevision", () => {
  it("is the current revision plus one, carrying who and when", () => {
    const current = { ...defaultRecord("ios"), revision: 2 };
    const parsed = parsePublish("ios", body);
    if (!parsed.ok) throw new Error("body refused");
    const next = nextRevision(current, parsed.value, "ana@example.com", new Date("2026-10-21T12:00:00Z"));
    expect(next).toMatchObject({ platform: "ios", revision: 3, latestVersion: "1.2.0", updatedBy: "ana@example.com", updatedAt: "2026-10-21T12:00:00.000Z" });
  });
});
