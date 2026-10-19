import { describe, expect, it } from "vitest";

import { dependencies, type OperationsInput,queues, share } from "./operations";

const healthy: OperationsInput = {
  platformHealth: { status: "healthy", services: { database: "up" }, version: "1.0.0", commit: "92fd33b" },
  overview: { catalogue: { videosByStatus: { READY: 40, PROCESSING: 2, PENDING_UPLOAD: 1, HELD: 0, FAILED: 3 } }, queues: { openReports: 4, creatorsAwaitingVerification: 1, payoutsInProgress: 2 } },
  storage: { enabled: true, platform: { level: "ok", percent: 12 }, lastReconciliation: { missingVideos: 0, orphanVideos: 1 } },
  platform: { history: { kind: "current", pending: 0 } },
};

describe("dependencies", () => {
  it("are up when the platform, its database, storage and migrations are", () => {
    expect(dependencies(healthy).map((d) => [d.id, d.health])).toEqual([["platform", "up"], ["database", "up"], ["storage", "up"], ["migrations", "up"]]);
  });
  it("say down, not nothing, when the platform does not answer", () => {
    const out = dependencies({ ...healthy, platformHealth: null, storage: null, platform: null });
    expect(out).toEqual([{ id: "platform", health: "down", detail: "no answer" }, { id: "database", health: "down", detail: "unknown" }]);
  });
  it("warn on a nearly full storage and on migrations waiting, fail on a full storage", () => {
    const warn = dependencies({ ...healthy, storage: { ...healthy.storage!, platform: { level: "critical", percent: 96 } }, platform: { history: { kind: "behind", pending: 2 } } });
    expect(warn.find((d) => d.id === "storage")?.health).toBe("degraded");
    expect(warn.find((d) => d.id === "migrations")).toMatchObject({ health: "degraded", detail: "2 waiting" });
    expect(dependencies({ ...healthy, storage: { ...healthy.storage!, platform: { level: "full", percent: 100 } } }).find((d) => d.id === "storage")?.health).toBe("down");
  });
});

describe("queues", () => {
  it("counts what is waiting and flags what needs a person", () => {
    const out = queues(healthy);
    expect(out.find((q) => q.id === "encoding")).toEqual({ id: "encoding", count: 3, attention: false });
    expect(out.find((q) => q.id === "failed")).toEqual({ id: "failed", count: 3, attention: true });
    expect(out.find((q) => q.id === "reports")).toEqual({ id: "reports", count: 4, attention: true });
  });
  it("shows nothing without the overview", () => {
    expect(queues({ ...healthy, overview: null })).toEqual([]);
  });
});

describe("share", () => {
  it("is capped at 1, 0 without a budget", () => {
    expect(share(3, 12)).toBe(0.25);
    expect(share(30, 12)).toBe(1);
    expect(share(3, 0)).toBe(0);
  });
});
