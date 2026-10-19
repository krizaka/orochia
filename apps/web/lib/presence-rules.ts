/**
 * Who may see whom online — the rule, as a pure function (lib/presence.ts runs the same rule in SQL to find a
 * person's circle, and the tests hold both to it).
 *
 * A presence is a signal about a body behind a screen: on an adult platform it is shared only where a relationship
 * both sides chose already exists, never with a stranger who opened an empty conversation to watch someone.
 *
 * The viewer sees the subject's presence ("online", "away", "seen 5 min ago") only when ALL of these hold:
 * 1. they are two different, active accounts (not suspended, address verified);
 * 2. neither has blocked the other;
 * 3. both show their presence (`profiles.show_presence`) — hiding yours hides everyone else's from you, as in
 *    Messenger: nobody watches without being seen;
 * 4. and one relationship links them:
 *    - an **accepted contact**, either direction;
 *    - an **exchange**: a conversation where both have written at least once (the subject answered — opening a
 *      conversation or sending into the void is not enough);
 *    - the viewer **follows the subject, a creator, and the creator approved it** — a fan sees the creators who let
 *      them in; the creator does not see that fan in return unless they are contacts or have talked.
 * Administrators get no exception: presence is not a moderation tool.
 */

export interface PresenceFacts {
  viewerId: string;
  subjectId: string;
  viewerActive: boolean;
  subjectActive: boolean;
  blockedEitherWay: boolean;
  viewerShows: boolean;
  subjectShows: boolean;
  acceptedContact: boolean;
  /** Both wrote in a conversation they share. */
  exchanged: boolean;
  /** The viewer's follow of the subject was approved, and the subject is a creator. */
  approvedFollowOfCreator: boolean;
}

export function presenceVisible(f: PresenceFacts): boolean {
  if (f.viewerId === f.subjectId) return false;
  if (!f.viewerActive || !f.subjectActive) return false;
  if (f.blockedEitherWay) return false;
  if (!f.viewerShows || !f.subjectShows) return false;
  return f.acceptedContact || f.exchanged || f.approvedFollowOfCreator;
}

/** The largest circle a stream follows (most recent relationships first). */
export const PRESENCE_CIRCLE_LIMIT = 300;

const OFFLINE = "offline" as const;
/** A presence event with no time: the person hid their presence (a person who left carries the time they were last seen). */
export const isHiddenPresence = (event: { state: string; lastSeenAt: string | null }): boolean => event.state === OFFLINE && event.lastSeenAt === null;
