import { describe, expect, it } from "vitest";

import { AnalyticsKind, type AnalyticsInsights, type AnalyticsFunnel } from "./analytics.types";
import { AudienceStatus, describeAudience, toAnalyticsEvent, watchOutcome } from "./analytics.view";

const insights: AnalyticsInsights = {
  range: { from: "2026-09-19T00:00:00Z", to: "2026-10-17T00:00:00Z" },
  owner: "c1",
  minAudience: 3,
  suppressed: false,
  events: { current: 40, previous: 20, change: 1 },
  activeSubjects: { current: 6, previous: 4, change: 0.5 },
  kinds: [
    { kind: "view", unit: "PERCENT", count: { current: 20, previous: 10, change: 1 }, subjects: 6, valueSum: null, valueMean: null },
    { kind: "watch", unit: "PERCENT", count: { current: 12, previous: 0, change: null }, subjects: 5, valueSum: 780, valueMean: 65 },
    { kind: "like", unit: "NONE", count: { current: 6, previous: 8, change: -0.25 }, subjects: 4, valueSum: null, valueMean: null },
  ],
  series: [
    { day: "2026-10-15", suppressed: false, activeSubjects: 4, events: { view: 5, like: 2 } },
    { day: "2026-10-16", suppressed: true, activeSubjects: null, events: {} },
  ],
  topItems: [{ itemId: "v1", ownerId: "c1", subjects: 4, engagements: 6, views: 9, meanWatchedPct: null }],
  cohorts: [{ week: "2026-10-05", size: 4, retention: [1, 0.5] }],
};

const funnel: AnalyticsFunnel = {
  range: insights.range,
  owner: "c1",
  windowHours: 168,
  minAudience: 3,
  steps: [
    { kind: "view", suppressed: false, subjects: 6, fromPrevious: null, fromFirst: 1 },
    { kind: "like", suppressed: false, subjects: 4, fromPrevious: 0.667, fromFirst: 0.667 },
    { kind: "tip", suppressed: true, subjects: null, fromPrevious: null, fromFirst: null },
  ],
};

describe("the creator's audience, as the page draws it", () => {
  it("turns figures into tiles with their trend, the watched share from the watch kind, a hidden figure as null", () => {
    const view = describeAudience(insights, funnel, new Map([["v1", "Jazz at midnight"]]));
    if (view.status !== AudienceStatus.Ok) throw new Error("expected ok");
    expect(view.tiles.map((t) => [t.key, t.value, t.trend])).toEqual([
      ["viewers", 6, "up"],
      ["views", 20, "up"],
      ["likes", 6, "down"],
      ["tips", null, "flat"],
      ["watched", 65, "flat"],
    ]);
    expect(view.series).toEqual([
      { day: "2026-10-15", viewers: 4, views: 5, likes: 2 },
      { day: "2026-10-16", viewers: null, views: null, likes: null },
    ]);
    expect(view.top).toEqual([{ id: "v1", title: "Jazz at midnight", viewers: 4, views: 9 }]);
    expect(view.funnel).toEqual([
      { kind: "view", subjects: 6 },
      { kind: "like", subjects: 4 },
    ]);
    expect(view.cohorts).toEqual([{ week: "2026-10-05", size: 4, retentionPct: [100, 50] }]);
  });

  it("keeps only the creator's own videos that still exist", () => {
    const view = describeAudience(insights, funnel, new Map());
    if (view.status !== AudienceStatus.Ok) throw new Error("expected ok");
    expect(view.top).toEqual([]);
  });

  it("says when the audience is too small to report, never a small number", () => {
    expect(describeAudience({ ...insights, suppressed: true }, funnel, new Map()).status).toBe(AudienceStatus.TooSmall);
  });
});

describe("what leaves Orochia", () => {
  it("an analytics event carries the pseudonym, never the account id", () => {
    const event = toAnalyticsEvent({ accountId: "acc-1", videoId: "v1", creatorId: "c1", kind: AnalyticsKind.Watch, value: 42, at: new Date("2026-10-16T10:00:00Z") }, "k".repeat(32), "e1");
    expect(event).toMatchObject({ id: "e1", kind: "watch", item: "v1", owner: "c1", value: 42, at: "2026-10-16T10:00:00.000Z" });
    expect(event.subject).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(event)).not.toContain("acc-1");
  });

  it("leaving a video records the share watched, and a skip when it was left at once", () => {
    const rule = { skipWithinSeconds: 3, skipBelowPct: 20 };
    expect(watchOutcome({ watchedSeconds: 2, durationSeconds: 60 }, rule)).toEqual({ watchedPct: 3, skip: true });
    expect(watchOutcome({ watchedSeconds: 30, durationSeconds: 60 }, rule)).toEqual({ watchedPct: 50, skip: false });
    expect(watchOutcome({ watchedSeconds: 90, durationSeconds: 60 }, rule)).toEqual({ watchedPct: 100, skip: false });
    expect(watchOutcome({ watchedSeconds: 0, durationSeconds: 0 }, rule)).toBeNull();
  });
});
