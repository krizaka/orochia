import { describe, expect, it } from "vitest";

import { hasBurnedWatermark } from "./watermark";

describe("the burned-in watermark", () => {
  const since = "2026-10-19T21:30:00Z";

  it("is absent while the library has none (no date set)", () => {
    expect(hasBurnedWatermark("2026-10-20T10:00:00Z", undefined)).toBe(false);
    expect(hasBurnedWatermark("2026-10-20T10:00:00Z", "")).toBe(false);
  });

  it("covers the videos created from the day it was turned on, never the older ones (they were encoded without it)", () => {
    expect(hasBurnedWatermark("2026-10-19T21:30:00Z", since)).toBe(true);
    expect(hasBurnedWatermark(new Date("2026-11-02T08:00:00Z"), since)).toBe(true);
    expect(hasBurnedWatermark("2026-10-19T21:29:59Z", since)).toBe(false);
  });

  it("answers no to a date it cannot read: the overlay stays", () => {
    expect(hasBurnedWatermark("not a date", since)).toBe(false);
    expect(hasBurnedWatermark("2026-10-20T10:00:00Z", "soon")).toBe(false);
    expect(hasBurnedWatermark(null, since)).toBe(false);
  });
});
