import type { ChallengeCardView } from "@/lib/challenges";

type Kind = ChallengeCardView["kind"];
type Stage = ChallengeCardView["stage"];

/** The stages a challenge of each kind walks through, in order, when all goes well. */
const PATHS: Record<Kind, readonly Stage[]> = {
  GOAL: ["FUNDING", "GOAL_REACHED", "IN_PROGRESS", "DELIVERED"],
  REQUEST: ["AWAITING_ANSWER", "IN_PROGRESS", "DELIVERED"],
  OPEN_CALL: ["CASTING", "IN_PROGRESS", "DELIVERED"],
};

export interface JourneyStep {
  stage: Stage;
  status: "done" | "current" | "upcoming" | "error";
}

/**
 * Where a challenge stands on its path, for a `Stepper`: the steps before its stage are done, its stage is current
 * (DELIVERED is done), the rest upcoming. A challenge that stopped (declined, expired, not delivered, withdrawn) shows
 * that end, as a failed step, where it stopped; CLOSING (settling at the deadline) stays on the first step.
 */
export function challengeJourney(kind: Kind, stage: Stage): JourneyStep[] {
  const path = PATHS[kind];
  const at = stage === "CLOSING" ? 0 : path.indexOf(stage);
  if (at >= 0) {
    return path.map((s, i) => ({ stage: s, status: i < at || s === "DELIVERED" && i === at ? "done" : i === at ? "current" : "upcoming" }));
  }
  // Stopped: an answer refused or a delivery missed stops after the start; the rest stop at the first step.
  const stoppedAt = stage === "FAILED" ? path.indexOf("IN_PROGRESS") : stage === "DECLINED" ? 1 : 0;
  return [
    ...path.slice(0, stoppedAt).map((s) => ({ stage: s, status: "done" as const })),
    { stage, status: "error" as const },
  ];
}
