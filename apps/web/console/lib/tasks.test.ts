import { describe, expect, it } from "vitest";

import { areaOf, type AuditEntry,outcomeOf } from "./audit-outcome";
import { deriveTasks, type TaskInput } from "./tasks";

// Dev preview `admin.operator-tasks`: the operator's queue is derived from what the platform and the audit say — never
// typed in. A refused or failed action with no later success is a task; a counter the platform reports is a task.
const NOW = Date.parse("2026-10-21T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const entry = (over: Partial<AuditEntry>): AuditEntry => ({ at: hoursAgo(1), action: "payout → SETTLED", target: "p1", outcome: "ok", requestId: "req-1", actor: "op@orochia.dev", detail: null, ...over });
const empty: TaskInput = { overview: null, storage: null, audit: [], now: NOW };

describe("outcome of an operator action", () => {
  it("is ok when it went through", () => {
    expect(outcomeOf(null)).toBe("ok");
  });
  it("is refused when Orochia answered with a client error (a rule said no)", () => {
    expect(outcomeOf({ status: 409 })).toBe("refused");
    expect(outcomeOf({ status: 403 })).toBe("refused");
  });
  it("is failed when Orochia could not do it (5xx, unreachable, thrown)", () => {
    expect(outcomeOf({ status: 502 })).toBe("failed");
    expect(outcomeOf(new Error("fetch failed"))).toBe("failed");
  });
});

describe("area of an action", () => {
  it("maps each action to the section of the console it belongs to", () => {
    expect(areaOf("report → RESOLVED")).toBe("Content");
    expect(areaOf("video taken down")).toBe("Content");
    expect(areaOf("creator approved (2257)")).toBe("People");
    expect(areaOf("role → ADMIN")).toBe("People");
    expect(areaOf("sessions ended")).toBe("People");
    expect(areaOf("account exported")).toBe("People");
    expect(areaOf("sign-in")).toBe("People");
    expect(areaOf("payout → SETTLED")).toBe("Money");
    expect(areaOf("auction cancelled")).toBe("Money");
    expect(areaOf("factory reset")).toBe("Platform");
    expect(areaOf("app versions → ios")).toBe("Platform");
    expect(areaOf("something new")).toBe("Platform");
  });
});

describe("the operator's tasks", () => {
  it("is empty when nothing waits", () => {
    expect(deriveTasks({ ...empty, overview: { queues: { openReports: 0, creatorsAwaitingVerification: 0, payoutsInProgress: 0 }, catalogue: { videosByStatus: { READY: 40 } } } })).toEqual([]);
  });

  it("turns the platform's counters into tasks, the urgent first", () => {
    const tasks = deriveTasks({
      ...empty,
      overview: { queues: { openReports: 3, creatorsAwaitingVerification: 2, payoutsInProgress: 1 }, catalogue: { videosByStatus: { READY: 9, FAILED: 1, HELD: 2 } } },
    });
    expect(tasks.map((t) => t.id)).toEqual(["reports", "failed-videos", "held-videos", "verification", "payouts"]);
    expect(tasks[0]).toMatchObject({ count: 3, href: "/moderation", urgency: "now", source: "platform" });
    expect(tasks.find((t) => t.id === "payouts")).toMatchObject({ urgency: "soon", href: "/treasury" });
  });

  it("makes a task of a refused or failed action of the last day that nothing later fixed", () => {
    const tasks = deriveTasks({
      ...empty,
      audit: [
        entry({ at: hoursAgo(2), action: "payout → SETTLED", target: "p9", outcome: "failed", requestId: "req-9" }),
        entry({ at: hoursAgo(3), action: "report → RESOLVED", target: "r1", outcome: "refused", requestId: "req-8" }),
      ],
    });
    expect(tasks.map((t) => t.id)).toEqual(["audit:payout → SETTLED:p9", "audit:report → RESOLVED:r1"]);
    expect(tasks[0]).toMatchObject({ source: "audit", urgency: "now", requestId: "req-9", href: "/audit?outcome=failed" });
    expect(tasks[1]).toMatchObject({ urgency: "soon", href: "/audit?outcome=refused" });
  });

  it("drops it once the same action on the same target later went through", () => {
    const tasks = deriveTasks({
      ...empty,
      audit: [
        entry({ at: hoursAgo(1), action: "payout → SETTLED", target: "p9", outcome: "ok" }),
        entry({ at: hoursAgo(2), action: "payout → SETTLED", target: "p9", outcome: "failed" }),
      ],
    });
    expect(tasks).toEqual([]);
  });

  it("ignores what is older than a day, and what succeeded", () => {
    const tasks = deriveTasks({ ...empty, audit: [entry({ at: hoursAgo(30), outcome: "failed", target: "old" }), entry({ outcome: "ok" })] });
    expect(tasks).toEqual([]);
  });

  it("counts the files Bunny lost as a task", () => {
    const tasks = deriveTasks({ ...empty, storage: { lastReconciliation: { missingVideos: 2, orphanVideos: 0 } } });
    expect(tasks).toEqual([expect.objectContaining({ id: "missing-files", count: 2, urgency: "now", href: "/storage" })]);
  });
});
