import { describe, expect, it } from "vitest";

import { compact, money, usd } from "@/lib/money";

describe("money", () => {
  it("formats US cents in the reader's locale", () => {
    expect(money(123450)).toBe("$1,234.50");
    expect(money(0)).toBe("$0.00");
    expect(money(5)).toBe("$0.05");
  });

  it("refuses a float: amounts are integers of minor units", () => {
    expect(() => money(12.5)).toThrow(TypeError);
  });

  it("keeps the deprecated usd() as the same formatter", () => {
    expect(usd(2000)).toBe(money(2000));
  });

  it("shortens counts", () => {
    expect(compact(12345)).toBe("12.3K");
  });
});
