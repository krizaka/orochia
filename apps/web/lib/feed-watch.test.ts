import { describe, expect, it } from "vitest";

import { createWatchTracker, type WatchReport } from "./feed-watch";

function setup() {
  let t = 1000;
  let n = 0;
  const sent: { report: WatchReport; leaving: boolean }[] = [];
  const tracker = createWatchTracker({ now: () => t, uuid: () => `visit-${++n}`, send: (report, leaving) => sent.push({ report, leaving }) });
  return { tracker, sent, advance: (ms: number) => void (t += ms) };
}

describe("the vertical feed's watch tracker", () => {
  it("reports the slide that left with its watched share and its time in view", () => {
    const { tracker, sent, advance } = setup();
    tracker.begin("a");
    advance(4000);
    tracker.progress(0.4);
    tracker.progress(0.2);
    tracker.begin("b");
    expect(sent).toEqual([{ report: { videoId: "a", visit: "visit-1", watchedPct: 40, dwellMs: 4000 }, leaving: false }]);
  });
  it("the same slide again is one look, not a new one", () => {
    const { tracker, sent } = setup();
    tracker.begin("a");
    tracker.begin("a");
    tracker.begin("a");
    expect(sent).toEqual([]);
  });
  it("leaving the page reports the current look once, as leaving", () => {
    const { tracker, sent, advance } = setup();
    tracker.begin("a");
    advance(1500);
    tracker.leave();
    tracker.leave();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ leaving: true, report: { videoId: "a", dwellMs: 1500 } });
  });
  it("a share is kept between 0 and 100, and a broken one is ignored", () => {
    const { tracker, sent } = setup();
    tracker.begin("a");
    tracker.progress(7);
    tracker.progress(Number.NaN);
    tracker.leave();
    expect(sent[0]!.report.watchedPct).toBe(100);
  });
});
