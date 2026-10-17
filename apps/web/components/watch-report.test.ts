import { describe, expect, it } from "vitest";

import { playedSeconds } from "./watch-report";

const ranges = (pairs: [number, number][]) => ({ length: pairs.length, start: (i: number) => pairs[i][0], end: (i: number) => pairs[i][1] });

describe("the seconds a viewer actually played", () => {
  it("adds the played ranges, so a seek is not counted as watching", () => {
    expect(playedSeconds(ranges([[0, 4.25], [30, 35]]))).toBe(9.3);
  });
  it("is zero when nothing played", () => {
    expect(playedSeconds(ranges([]))).toBe(0);
  });
});
