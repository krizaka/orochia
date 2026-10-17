import { describe, expect, it } from "vitest";

import { isBlank, MIN_SPREAD, problemOf } from "./dev-dataset/thumbnails.mjs";

// The luma stats come from ffmpeg's signalstats in real runs (not available in CI): the decision is tested on the numbers.
const FLAT = { ylow: 30, yhigh: 30, yavg: 30 }; // « Automation demo: morning PDFs »: a flat grey frame
const PICTURE = { ylow: 8, yhigh: 231, yavg: 96 };
const answer = (status = 200) => async () => ({ status, arrayBuffer: async () => new ArrayBuffer(4) });

describe("a public video's thumbnail", () => {
  it("is blank when the darkest and brightest pixels are close; a dark but real picture is not", () => {
    expect(isBlank(FLAT)).toBe(true);
    expect(isBlank(PICTURE)).toBe(false);
    expect(isBlank({ ylow: 2, yhigh: 2 + MIN_SPREAD - 1 })).toBe(true);
    expect(isBlank({ ylow: 2, yhigh: 2 + MIN_SPREAD })).toBe(false);
  });
  it("fails the check when missing, not found, or blank — passes with a real picture", async () => {
    expect(await problemOf(null)).toBe("no thumbnail");
    expect(await problemOf("https://x/t.jpg", answer(404), () => PICTURE)).toBe("thumbnail answers 404");
    expect(await problemOf("https://x/t.jpg", answer(), () => FLAT)).toMatch(/^blank frame/);
    expect(await problemOf("https://x/t.jpg", answer(), () => PICTURE)).toBeNull();
  });
});
