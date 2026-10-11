import { describe, expect, it } from "vitest";

import { challengeJourney } from "./journey";

const statuses = (steps: ReturnType<typeof challengeJourney>) => steps.map((s) => `${s.stage}:${s.status}`);

describe("challengeJourney", () => {
  it("walks a goal from funding to delivery", () => {
    expect(statuses(challengeJourney("GOAL", "FUNDING"))).toEqual(["FUNDING:current", "GOAL_REACHED:upcoming", "IN_PROGRESS:upcoming", "DELIVERED:upcoming"]);
    expect(statuses(challengeJourney("GOAL", "IN_PROGRESS"))).toEqual(["FUNDING:done", "GOAL_REACHED:done", "IN_PROGRESS:current", "DELIVERED:upcoming"]);
    expect(statuses(challengeJourney("GOAL", "DELIVERED")).every((s) => s.endsWith(":done"))).toBe(true);
  });

  it("keeps a closing challenge on its first step", () => {
    expect(challengeJourney("REQUEST", "CLOSING")[0]).toEqual({ stage: "AWAITING_ANSWER", status: "current" });
  });

  it("shows where a challenge stopped", () => {
    expect(statuses(challengeJourney("REQUEST", "DECLINED"))).toEqual(["AWAITING_ANSWER:done", "DECLINED:error"]);
    expect(statuses(challengeJourney("GOAL", "FAILED"))).toEqual(["FUNDING:done", "GOAL_REACHED:done", "FAILED:error"]);
    expect(statuses(challengeJourney("OPEN_CALL", "EXPIRED"))).toEqual(["EXPIRED:error"]);
  });
});
