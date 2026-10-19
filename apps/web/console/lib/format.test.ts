import { describe, expect, it } from "vitest";

import { fileSize, minutes, money, size } from "./format";

describe("format", () => {
  it("writes cents as dollars", () => expect(money(123456)).toBe("$1,234.56"));
  it("sizes a quota, null being unlimited", () => {
    expect(size(null)).toBe("unlimited");
    expect(size(5 * 1024 ** 3)).toBe("5.0 GB");
    expect(size(300 * 1024 ** 2)).toBe("300 MB");
  });
  it("minutes of video, null being unlimited", () => {
    expect(minutes(null)).toBe("unlimited");
    expect(minutes(3600)).toBe("60 min");
  });
  it("sizes a backup file with a 1 KB floor", () => {
    expect(fileSize(10)).toBe("1 KB");
    expect(fileSize(2 * 1024 ** 2)).toBe("2.0 MB");
  });
});
