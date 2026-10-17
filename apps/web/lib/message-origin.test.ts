import { describe, expect, it } from "vitest";

import { DEFAULT_MESSAGE_ORIGIN, isAiAssisted, MESSAGE_ORIGINS, parseMessageOrigin } from "./message-origin";

describe("message origin (orazaka-packs#41: AI-assisted replies must be disclosed)", () => {
  it("is human by default", () => {
    expect(DEFAULT_MESSAGE_ORIGIN).toBe("human");
    expect(MESSAGE_ORIGINS).toEqual(["human", "ai_assisted"]);
  });
  it("reads an unknown value as human, never as a hidden AI", () => {
    expect(parseMessageOrigin("ai_assisted")).toBe("ai_assisted");
    expect(parseMessageOrigin("robot")).toBe("human");
    expect(parseMessageOrigin(null)).toBe("human");
  });
  it("knows which messages carry the disclosure", () => {
    expect(isAiAssisted("ai_assisted")).toBe(true);
    expect(isAiAssisted("human")).toBe(false);
  });
});
