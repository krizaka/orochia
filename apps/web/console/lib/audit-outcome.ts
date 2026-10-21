/**
 * What an operator action came to, and where it belongs. Pure: the audit writes these words, the log and the Tasks view
 * read them (ADR-085 of krizaka/orazaka: the same shape in every Krizaka console — who, what, when, request id, outcome).
 *
 *  - `ok`      Orochia did it.
 *  - `refused` Orochia answered with a client error: a rule said no (the screen shows its message).
 *  - `failed`  Orochia could not do it: a 5xx, no answer, or the console itself threw.
 */
export type Outcome = "ok" | "refused" | "failed";

export interface AuditEntry {
  at: string;
  action: string;
  target: string | null;
  outcome: Outcome;
  requestId: string | null;
  actor: string | null;
  detail: string | null;
}

/** `null` is the absence of an error: the action went through. */
export function outcomeOf(error: unknown): Outcome {
  if (error === null || error === undefined) return "ok";
  const status = typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : NaN;
  return status >= 400 && status < 500 ? "refused" : "failed";
}

/** The old rows have no outcome: a success is ok, anything else was an answer of Orochia, so refused. */
export const legacyOutcome = (ok: boolean): Outcome => (ok ? "ok" : "refused");

export type Area = "People" | "Content" | "Money" | "Platform";

/** The section of the console (lib/nav.ts) an action belongs to, from its words; anything new is the platform's. */
export function areaOf(action: string): Area {
  if (/^(report|conversation|video )/.test(action)) return "Content";
  if (/^(creator|role|sessions|account|sign-in)/.test(action)) return "People";
  if (/^(payout|auction)/.test(action)) return "Money";
  return "Platform";
}
