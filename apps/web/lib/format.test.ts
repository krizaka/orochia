import { describe, expect, it } from "vitest";

import { amountChoices } from "@/lib/money";

import { bytes, compact, duration, money, speed } from "./format";

describe("amounts, counts, sizes and durations", () => {
  it("formats US cents in the reader's language", () => {
    expect(money(123450, "en")).toBe("$1,234.50");
    expect(money(0, "en")).toBe("$0.00");
    expect(money(5, "en")).toBe("$0.05");
    // Québec writes the amount after the number, with a space as thousands separator and a comma for decimals.
    expect(money(123450, "fr").replace(/\s/g, " ")).toMatch(/^1 234,50 \$/);
  });

  it("refuses a float: amounts are integers of minor units", () => {
    expect(() => money(12.5, "en")).toThrow(TypeError);
  });

  it("shortens counts", () => {
    expect(compact(12345, "en")).toBe("12.3K");
    expect(compact(12345, "fr").replace(/\s/g, " ")).toMatch(/^12,3 k$/i);
  });

  it("writes sizes in the largest fitting unit, in French with Go/Mo/ko", () => {
    expect(bytes(1_572_864, "en")).toBe("1.5 MB");
    expect(bytes(4 * 1024 ** 3, "en")).toBe("4 GB");
    expect(bytes(1_572_864, "fr")).toMatch(/Mo/);
    expect(bytes(4 * 1024 ** 3, "fr")).toMatch(/Go/);
  });

  it("writes speeds and durations, nothing while unknown", () => {
    expect(speed(0, "en")).toBeNull();
    expect(speed(2 * 1024 ** 2, "en")).toBe("2 MB/s");
    expect(duration(null, "en")).toBeNull();
    expect(duration(95, "en")).toBe("1 min 35 sec");
    expect(duration(7500, "en")).toBe("2 hr 5 min");
    expect(duration(95, "fr")?.replace(/\s/g, " ")).toBe("1 min 35 s");
  });

  it("offers the creator's price first, then the usual steps above it", () => {
    expect(amountChoices(800).map((c) => c.cents)).toEqual([800, 1000, 2500, 5000]);
    expect(amountChoices(100).map((c) => c.cents)).toEqual([500, 1000, 2500, 5000]);
    expect(amountChoices(2500).map((c) => c.cents)).toEqual([2500, 5000, 10000, 20000]);
  });
});
