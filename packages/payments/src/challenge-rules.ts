/**
 * The rules of an Orochia challenge, as pure functions (no database, no clock of their own) so the server, the UI and
 * the tests apply the same ones. Amounts are cents (1 credit = 1 US cent).
 */

export type ChallengeKind = "GOAL" | "REQUEST" | "OPEN_CALL";
export type ChallengeStatus = "OPEN" | "ACCEPTED" | "DELIVERED" | "DECLINED" | "EXPIRED" | "FAILED" | "CANCELLED";

/** Smallest and largest pledge; a goal's target range; an open call's smallest starting pot. */
export const CHALLENGE_MIN_PLEDGE_CENTS = 100;
export const CHALLENGE_MAX_PLEDGE_CENTS = 1_000_000_00;
export const CHALLENGE_MIN_GOAL_CENTS = 10_00;
export const CHALLENGE_MAX_GOAL_CENTS = 1_000_000_00;
export const CHALLENGE_MIN_OPEN_CALL_CENTS = 5_00;

/** A creator answers a request within three days; past that it expires and every pledge comes back. */
export const CHALLENGE_REQUEST_RESPONSE_MS = 72 * 60 * 60 * 1000;

/** A goal takes pledges for one hour to thirty days; an open call waits for its pick one hour to fourteen days. */
export const CHALLENGE_MIN_WINDOW_MS = 60 * 60 * 1000;
export const CHALLENGE_MAX_GOAL_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
export const CHALLENGE_MAX_OPEN_CALL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Once committed, the creator delivers within one to fourteen days (seven unless chosen). */
export const CHALLENGE_MIN_DELIVERY_DAYS = 1;
export const CHALLENGE_MAX_DELIVERY_DAYS = 14;
export const CHALLENGE_DEFAULT_DELIVERY_DAYS = 7;

export const CHALLENGE_TITLE_MAX = 120;
export const CHALLENGE_DESCRIPTION_MAX = 1000;

/** One-tap pledges offered to a backer. */
export const CHALLENGE_SUGGESTED_PLEDGES_CENTS = [5_00, 10_00, 25_00, 50_00] as const;

export type DraftProblem = "BAD_TITLE" | "BAD_DESCRIPTION" | "BAD_GOAL" | "BAD_DEADLINE" | "BAD_DELIVERY_DAYS" | "BAD_AMOUNT";

export interface ChallengeDraft {
  kind: ChallengeKind;
  title: string;
  description: string;
  deliveryDays: number;
  /** GOAL: its target. */
  goalCents?: number | null;
  /** GOAL and OPEN_CALL: the end of the pledging / picking window. REQUEST: ignored (72 hours). */
  deadline?: Date | null;
  /** REQUEST and OPEN_CALL: what the author puts in first. */
  offerCents?: number | null;
}

/** Checks what an author wrote; returns the deadline the challenge will have, or the first problem found. */
export function checkChallengeDraft(draft: ChallengeDraft, now: Date): { ok: true; deadline: Date } | { ok: false; problem: DraftProblem } {
  const title = draft.title.trim();
  if (title.length < 4 || title.length > CHALLENGE_TITLE_MAX) return { ok: false, problem: "BAD_TITLE" };
  const description = draft.description.trim();
  if (description.length < 10 || description.length > CHALLENGE_DESCRIPTION_MAX) return { ok: false, problem: "BAD_DESCRIPTION" };
  if (!Number.isInteger(draft.deliveryDays) || draft.deliveryDays < CHALLENGE_MIN_DELIVERY_DAYS || draft.deliveryDays > CHALLENGE_MAX_DELIVERY_DAYS) {
    return { ok: false, problem: "BAD_DELIVERY_DAYS" };
  }
  if (draft.kind === "GOAL") {
    const goal = draft.goalCents ?? 0;
    if (!Number.isInteger(goal) || goal < CHALLENGE_MIN_GOAL_CENTS || goal > CHALLENGE_MAX_GOAL_CENTS) return { ok: false, problem: "BAD_GOAL" };
  } else {
    const offer = draft.offerCents ?? 0;
    const minimum = draft.kind === "OPEN_CALL" ? CHALLENGE_MIN_OPEN_CALL_CENTS : CHALLENGE_MIN_PLEDGE_CENTS;
    if (!Number.isInteger(offer) || offer < minimum || offer > CHALLENGE_MAX_PLEDGE_CENTS) return { ok: false, problem: "BAD_AMOUNT" };
  }
  if (draft.kind === "REQUEST")
    return {
      ok: true,
      deadline: new Date(now.getTime() + CHALLENGE_REQUEST_RESPONSE_MS),
    };
  const deadline = draft.deadline;
  if (!deadline || Number.isNaN(deadline.getTime())) return { ok: false, problem: "BAD_DEADLINE" };
  const window = deadline.getTime() - now.getTime();
  const max = draft.kind === "GOAL" ? CHALLENGE_MAX_GOAL_WINDOW_MS : CHALLENGE_MAX_OPEN_CALL_WINDOW_MS;
  // A minute of slack: the form was filled a moment ago.
  if (window < CHALLENGE_MIN_WINDOW_MS - 60 * 1000 || window > max) return { ok: false, problem: "BAD_DEADLINE" };
  return { ok: true, deadline };
}

/** Whether a pledge amount is acceptable. */
export function isValidPledge(amountCents: number): boolean {
  return Number.isInteger(amountCents) && amountCents >= CHALLENGE_MIN_PLEDGE_CENTS && amountCents <= CHALLENGE_MAX_PLEDGE_CENTS;
}

/** A goal's progress, 0 to 1 and beyond (a goal can be passed); null for kinds without a goal. */
export function challengeProgress(challenge: { goalCents: number | null; pledgedCents: number }): number | null {
  if (!challenge.goalCents) return null;
  return challenge.pledgedCents / challenge.goalCents;
}

/**
 * Where a challenge stands for a viewer, from its status, its kind and the clock. FUNDING / GOAL_REACHED (a goal taking
 * pledges), AWAITING_ANSWER (a request), CASTING (an open call taking applications), CLOSING (open past its deadline,
 * about to be settled), IN_PROGRESS (a creator must deliver), then the final statuses.
 */
export type ChallengeStage =
  "FUNDING" | "GOAL_REACHED" | "AWAITING_ANSWER" | "CASTING" | "CLOSING" | "IN_PROGRESS" | "DELIVERED" | "DECLINED" | "EXPIRED" | "FAILED" | "CANCELLED";

export function challengeStage(
  challenge: {
    kind: ChallengeKind;
    status: ChallengeStatus;
    deadline: Date;
    goalCents: number | null;
    pledgedCents: number;
  },
  now: Date,
): ChallengeStage {
  if (challenge.status === "ACCEPTED") return "IN_PROGRESS";
  if (challenge.status !== "OPEN") return challenge.status;
  if (now >= challenge.deadline) return "CLOSING";
  if (challenge.kind === "REQUEST") return "AWAITING_ANSWER";
  if (challenge.kind === "OPEN_CALL") return "CASTING";
  return (challengeProgress(challenge) ?? 0) >= 1 ? "GOAL_REACHED" : "FUNDING";
}

/** The delivery deadline of a challenge a creator commits to at `now`. */
export function deliveryDeadline(deliveryDays: number, now: Date): Date {
  return new Date(now.getTime() + deliveryDays * 24 * 60 * 60 * 1000);
}
