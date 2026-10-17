import { describe, expect, it } from "vitest";

import { CHALLENGE_STARTS,challengeKindFromSlug, challengeStartHref } from "./challenge-kinds";

describe("starting a challenge from a card", () => {
  it("every explainer card has an address that preselects its kind", () => {
    expect(CHALLENGE_STARTS.map((s) => challengeStartHref(s.slug))).toEqual(["/challenges?new=goal", "/challenges?new=dare", "/challenges?new=call"]);
    expect(challengeKindFromSlug("goal")).toBe("GOAL");
    expect(challengeKindFromSlug("dare")).toBe("REQUEST");
    expect(challengeKindFromSlug("call")).toBe("OPEN_CALL");
  });
  it("ignores anything else", () => {
    expect(challengeKindFromSlug("x")).toBeNull();
    expect(challengeKindFromSlug(undefined)).toBeNull();
  });
});
