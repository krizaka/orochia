import { describe, expect, it } from "vitest";

import { bytes, duration, speed } from "@/lib/units";

describe("units", () => {
  it("writes sizes in the largest fitting unit", () => {
    expect(bytes(512)).toBe("512 byte");
    expect(bytes(1_572_864)).toBe("1.5 MB");
    expect(bytes(4 * 1024 ** 3)).toBe("4 GB");
  });

  it("writes speeds, nothing before it is known", () => {
    expect(speed(0)).toBeNull();
    expect(speed(2.5 * 1024 ** 2)).toBe("2.5 MB/s");
  });

  it("writes durations with their two largest units", () => {
    expect(duration(null)).toBeNull();
    expect(duration(12)).toBe("12 sec");
    expect(duration(95)).toBe("1 min 35 sec");
    expect(duration(7500)).toBe("2 hr 5 min");
  });
});
