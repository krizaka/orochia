import { describe, expect, it } from "vitest";
import {
  CHALLENGE_MAX_GOAL_WINDOW_MS,
  CHALLENGE_REQUEST_RESPONSE_MS,
  challengeProgress,
  challengeStage,
  checkChallengeDraft,
  deliveryDeadline,
  isValidPledge,
} from "./challenge-rules";

const now = new Date("2026-01-01T12:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3600_000);
const base = {
  title: "Sunrise rooftop session",
  description: "A one-take video at sunrise on the rooftop.",
  deliveryDays: 7,
};

describe("challenge rules", () => {
  it("accepts a goal with a target and a window, and refuses one without", () => {
    expect(checkChallengeDraft({ ...base, kind: "GOAL", goalCents: 50_00, deadline: inHours(48) }, now)).toEqual({ ok: true, deadline: inHours(48) });
    expect(checkChallengeDraft({ ...base, kind: "GOAL", goalCents: 5_00, deadline: inHours(48) }, now)).toEqual({ ok: false, problem: "BAD_GOAL" });
    expect(checkChallengeDraft({ ...base, kind: "GOAL", goalCents: 50_00, deadline: null }, now)).toEqual({ ok: false, problem: "BAD_DEADLINE" });
    expect(
      checkChallengeDraft(
        {
          ...base,
          kind: "GOAL",
          goalCents: 50_00,
          deadline: new Date(now.getTime() + CHALLENGE_MAX_GOAL_WINDOW_MS + 3600_000),
        },
        now,
      ),
    ).toEqual({ ok: false, problem: "BAD_DEADLINE" });
  });

  it("gives a request three days for an answer, whatever deadline was sent", () => {
    const result = checkChallengeDraft({ ...base, kind: "REQUEST", offerCents: 20_00, deadline: inHours(1) }, now);
    expect(result).toEqual({
      ok: true,
      deadline: new Date(now.getTime() + CHALLENGE_REQUEST_RESPONSE_MS),
    });
  });

  it("needs a starting pot for an open call and checks the text", () => {
    expect(checkChallengeDraft({ ...base, kind: "OPEN_CALL", offerCents: 1_00, deadline: inHours(24) }, now)).toEqual({ ok: false, problem: "BAD_AMOUNT" });
    expect(
      checkChallengeDraft(
        {
          ...base,
          kind: "OPEN_CALL",
          title: "No",
          offerCents: 10_00,
          deadline: inHours(24),
        },
        now,
      ),
    ).toEqual({ ok: false, problem: "BAD_TITLE" });
    expect(
      checkChallengeDraft(
        {
          ...base,
          kind: "OPEN_CALL",
          deliveryDays: 30,
          offerCents: 10_00,
          deadline: inHours(24),
        },
        now,
      ),
    ).toEqual({ ok: false, problem: "BAD_DELIVERY_DAYS" });
  });

  it("bounds pledges", () => {
    expect(isValidPledge(99)).toBe(false);
    expect(isValidPledge(100)).toBe(true);
    expect(isValidPledge(10.5)).toBe(false);
  });

  it("tells the stage from status, kind, progress and the clock", () => {
    const goal = {
      kind: "GOAL" as const,
      status: "OPEN" as const,
      deadline: inHours(5),
      goalCents: 100_00,
      pledgedCents: 40_00,
    };
    expect(challengeProgress(goal)).toBe(0.4);
    expect(challengeStage(goal, now)).toBe("FUNDING");
    expect(challengeStage({ ...goal, pledgedCents: 120_00 }, now)).toBe("GOAL_REACHED");
    expect(challengeStage(goal, inHours(6))).toBe("CLOSING");
    expect(challengeStage({ ...goal, kind: "REQUEST", goalCents: null }, now)).toBe("AWAITING_ANSWER");
    expect(challengeStage({ ...goal, kind: "OPEN_CALL", goalCents: null }, now)).toBe("CASTING");
    expect(challengeStage({ ...goal, status: "ACCEPTED" }, now)).toBe("IN_PROGRESS");
    expect(challengeStage({ ...goal, status: "FAILED" }, now)).toBe("FAILED");
  });

  it("counts the delivery window in days from the commitment", () => {
    expect(deliveryDeadline(7, now)).toEqual(inHours(7 * 24));
  });
});
