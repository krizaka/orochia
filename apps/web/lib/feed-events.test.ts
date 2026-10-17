import { describe, expect, it } from "vitest";

import { WatchEventInput } from "./feed-events";

const ID = "6b1f5c2e-2d1a-4f3b-9a55-0d2f6a1e9c10";

describe("the vertical feed's watch event", () => {
  it("takes a video, a visit, the watched share and the time in view", () => {
    expect(WatchEventInput.parse({ videoId: ID, visit: ID, watchedPct: 42.5, dwellMs: 3000 }).watchedPct).toBe(42.5);
  });
  it("refuses an id that is not a uuid, a share outside 0–100 and a negative time", () => {
    expect(() => WatchEventInput.parse({ videoId: "1 or 1=1", visit: ID, watchedPct: 1, dwellMs: 1 })).toThrow();
    expect(() => WatchEventInput.parse({ videoId: ID, visit: ID, watchedPct: 101, dwellMs: 1 })).toThrow();
    expect(() => WatchEventInput.parse({ videoId: ID, visit: ID, watchedPct: 1, dwellMs: -1 })).toThrow();
  });
});
