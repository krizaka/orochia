import type { NotificationEvent } from "./profile";
import { NOTIFICATION_EVENTS } from "./profile";

/**
 * Notifications as a matrix: five categories × two channels (krizaka/orochia#261). The channels are the app (the bell
 * and the phone's push, one switch) and e-mail. It is only a view: the database keeps the two per-event "off" lists
 * (`profiles.in_app_off`, `profiles.emails_off`), which `matrixFromOff` / `offFromMatrix` convert both ways, so the
 * sender (lib/notifications.ts) is unchanged. The account category (storage, your videos' status…) cannot be turned
 * off — and the security mails (verification, password reset) are not notifications at all: they are always sent.
 */

export const CATEGORIES = ["messages", "follows", "earnings", "auctionsChallenges", "account"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Never turned off, never unsubscribable. */
export const SECURITY_CATEGORY: Category = "account";

const OF: Record<NotificationEvent, Category> = {
  newMessage: "messages",
  newFollower: "follows",
  contactRequest: "follows",
  newComment: "follows",
  commentReply: "follows",
  creatorPublished: "follows",
  tipReceived: "earnings",
  videoUnlocked: "earnings",
  auctionAnnounced: "auctionsChallenges",
  auctionNewBid: "auctionsChallenges",
  auctionOutbid: "auctionsChallenges",
  auctionWon: "auctionsChallenges",
  auctionDecision: "auctionsChallenges",
  auctionSold: "auctionsChallenges",
  auctionUnsold: "auctionsChallenges",
  auctionDeclined: "auctionsChallenges",
  challengeAnnounced: "auctionsChallenges",
  challengeRequested: "auctionsChallenges",
  challengePledged: "auctionsChallenges",
  challengeFunded: "auctionsChallenges",
  challengeAccepted: "auctionsChallenges",
  challengeApplied: "auctionsChallenges",
  challengeChosen: "auctionsChallenges",
  challengeDelivered: "auctionsChallenges",
  challengeReleased: "auctionsChallenges",
  challengeClosed: "auctionsChallenges",
  videoReady: "account",
  storageLow: "account",
  storageHeld: "account",
  storageAlert: "account",
};

export const categoryOf = (event: NotificationEvent): Category => OF[event];
export const eventsOf = (category: Category): NotificationEvent[] => NOTIFICATION_EVENTS.filter((e) => OF[e] === category);

export type Channel = "app" | "email";
export type Matrix = Record<Category, Record<Channel, boolean>>;

const everything = (): Matrix => Object.fromEntries(CATEGORIES.map((c) => [c, { app: true, email: true }])) as Matrix;

/** The matrix of two "off" lists: a category is on for a channel when none of its events is off there. */
export function matrixFromOff(inAppOff: readonly string[], emailsOff: readonly string[]): Matrix {
  const m = everything();
  for (const c of CATEGORIES) {
    const events = eventsOf(c);
    m[c] = { app: events.every((e) => !inAppOff.includes(e)), email: events.every((e) => !emailsOff.includes(e)) };
  }
  return m;
}

/** The two "off" lists of a matrix. The security category is always on, whatever the matrix says. */
export function offFromMatrix(matrix: Matrix): { inAppOff: NotificationEvent[]; emailsOff: NotificationEvent[] } {
  const inAppOff: NotificationEvent[] = [];
  const emailsOff: NotificationEvent[] = [];
  for (const c of CATEGORIES) {
    if (c === SECURITY_CATEGORY) continue;
    if (!matrix[c].app) inAppOff.push(...eventsOf(c));
    if (!matrix[c].email) emailsOff.push(...eventsOf(c));
  }
  return { inAppOff, emailsOff };
}

export const PRESETS = ["all", "essentials", "securityOnly"] as const;
export type Preset = (typeof PRESETS)[number];

/**
 * - `all`: everything, in the app and by e-mail.
 * - `essentials`: messages, earnings and the account by e-mail; the rest in the app only.
 * - `securityOnly`: nothing but the account category (and the security mails, which no setting touches).
 */
export function applyPreset(preset: Preset): Matrix {
  const m = everything();
  if (preset === "essentials") {
    m.follows.email = false;
    m.auctionsChallenges.email = false;
  }
  if (preset === "securityOnly") {
    for (const c of CATEGORIES) if (c !== SECURITY_CATEGORY) m[c] = { app: false, email: false };
  }
  return m;
}

/** The preset a matrix is, or null for a mix of one's own. */
export function presetOf(matrix: Matrix): Preset | null {
  const same = (a: Matrix, b: Matrix) => CATEGORIES.every((c) => a[c].app === b[c].app && a[c].email === b[c].email);
  // The security category is not a choice: compare as the server would store it.
  const stored = (m: Matrix) => matrixFromOff(offFromMatrix(m).inAppOff, offFromMatrix(m).emailsOff);
  return PRESETS.find((p) => same(stored(matrix), stored(applyPreset(p)))) ?? null;
}

/** Can an e-mail's "unsubscribe" link switch this category off? Never the security one. */
export const unsubscribable = (category: Category): boolean => category !== SECURITY_CATEGORY;
