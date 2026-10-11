import { describe, expect, it } from "vitest";
import { reconcileIntervalMinutes, summariseLibrary } from "./storage-reconcile";

const item = (guid: string, storageSize: number, length = 0) => ({ guid, storageSize, length, title: guid, dateUploaded: "2026-10-01T00:00:00" });

describe("reconciliation with Bunny (mocked library)", () => {
  it("totals the library and finds the videos no row knows", () => {
    const summary = summariseLibrary([item("a", 100, 10.4), item("b", 50, 5), item("orphan", 70, 3)], new Set(["a", "b", "deleted-at-bunny"]));
    expect(summary.libraryBytes).toBe(220);
    expect(summary.librarySeconds).toBe(18);
    expect(summary.orphans.map((o) => o.guid)).toEqual(["orphan"]);
    expect(summary.orphanBytes).toBe(70);
  });

  it("treats a missing or negative size as nothing", () => {
    const summary = summariseLibrary([item("a", Number.NaN), item("b", -5)], new Set());
    expect(summary.libraryBytes).toBe(0);
    expect(summary.orphanBytes).toBe(0);
  });

  it("runs every 6 hours by default, never with 0", () => {
    expect(reconcileIntervalMinutes({})).toBe(360);
    expect(reconcileIntervalMinutes({ QUOTA_RECONCILE_INTERVAL_MINUTES: "0" })).toBe(0);
    expect(reconcileIntervalMinutes({ QUOTA_RECONCILE_INTERVAL_MINUTES: "nope" })).toBe(360);
  });
});
