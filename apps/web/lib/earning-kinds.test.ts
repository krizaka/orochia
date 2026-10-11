import { describe, expect, it } from "vitest";

import { earningKind } from "@/lib/earning-kinds";

describe("earningKind", () => {
  it("reads what paid from the settlement's note", () => {
    expect(earningKind("Video unlock")).toBe("unlock");
    expect(earningKind("Director's cut unlock")).toBe("unlock");
    expect(earningKind("Creator tip")).toBe("tip");
    expect(earningKind("Story tip")).toBe("tip");
    expect(earningKind("Auction sale")).toBe("auction");
    expect(earningKind("Challenge delivered")).toBe("challenge");
  });

  it("counts an unlabelled credit as a tip", () => {
    expect(earningKind(null)).toBe("tip");
    expect(earningKind("Creator tip & video unlock")).toBe("unlock");
  });
});
