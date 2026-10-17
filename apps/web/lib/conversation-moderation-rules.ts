/** What an operator may do about a reported conversation, and how much of it they read (ADR 0002). */

/** The reported message and this many either side: moderation never reads a whole group. */
export const NEIGHBOUR_WINDOW = 10;

export const MODERATION_ACTIONS = ["remove_message", "remove_member", "archive"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export function contextRange(seq: number, window = NEIGHBOUR_WINDOW): { from: number; to: number } {
  return { from: Math.max(1, seq - window), to: seq + window };
}
