/**
 * Who is looking, as far as calls to action are concerned, and where each next step leads (docs/CREATOR_ONBOARDING.md).
 * Pure: the server reads the account (lib/viewer.ts), the client its profile (lib/auth-context.tsx); both resolve the
 * state here, so a page and the navigation never disagree. Rule: a signed-in person is never sent to the sign-up form —
 * opening a creator space is a change of role of *their* account (`/api/me/become-creator`), not a new account.
 */

/** anonymous · member (a fan) · creator-pending (2257 review not approved yet) · creator (verified, or the owner) · suspended. */
export type ViewerState = "anonymous" | "member" | "creator-pending" | "creator" | "suspended";

/** The account fields that decide the state (`users.role`, `users.is_verified`, `users.suspended_at`). */
export interface ViewerAccount {
  role: "MEMBER" | "CREATOR" | "ADMIN";
  isVerified: boolean;
  suspended?: boolean;
}

export function viewerStateOf(account: ViewerAccount | null | undefined): ViewerState {
  if (!account) return "anonymous";
  if (account.suspended) return "suspended";
  // The owner (ADMIN) is created verified and publishes like a creator (packages/db/src/owner.ts).
  if (account.role === "ADMIN") return "creator";
  if (account.role === "CREATOR") return account.isVerified ? "creator" : "creator-pending";
  return "member";
}

/** The creator application of the signed-in account: its steps, its status, the button. */
export const CREATOR_APPLY_PATH = "/creator/apply";
/** Where a verified creator publishes. */
export const CREATOR_UPLOAD_PATH = "/creator/upload";
/** The creator's own videos (the studio). */
export const CREATOR_STUDIO_PATH = "/dashboard?tab=uploads";

/** A same-site path (`/x`, never `//host` or `https://…`), or null. */
export function safeNext(next: string | null | undefined): string | null {
  return next && /^\/(?![/\\])/.test(next) ? next : null;
}

/**
 * Where a new account goes once its e-mail is confirmed (the sign-up form's `next`, kept in this browser until the
 * verification link is opened — `/auth/verify` reads it once). Per-viewer convenience: lost, the dashboard is next.
 */
export const NEXT_AFTER_VERIFY_KEY = "orochia_next_after_verify";

/** The sign-up form, coming back to `next` once the account exists (and its e-mail is confirmed). */
export function signUpHref(next?: string): string {
  return next ? `/auth/register?next=${encodeURIComponent(next)}` : "/auth/register";
}

/** The sign-in form, coming back to `next`. */
export function signInHref(next?: string): string {
  return next ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login";
}

/** The words of a call to action, as keys of messages/en.json (`creatorSpace.cta.*`, `feed.actions.*`). */
export type CtaKey =
  | "creatorSpace.cta.anonymous"
  | "creatorSpace.cta.member"
  | "creatorSpace.cta.pending"
  | "creatorSpace.cta.creator"
  | "feed.actions.join"
  | "feed.actions.signIn"
  | "feed.actions.explore"
  | "feed.actions.findPeople"
  | "feed.actions.network"
  | "feed.actions.allVideos";

export interface Cta {
  href: string;
  label: CtaKey;
  /** The one action of the block (drawn as the primary button). */
  primary?: boolean;
}

/**
 * "Publish on Orochia", for each viewer: a visitor signs up first and lands on the application; a member opens the
 * creator space of their own account; a pending creator sees the status of the review; a creator uploads.
 * A suspended account is offered nothing.
 */
export function creatorSpaceCta(state: ViewerState): Cta | null {
  switch (state) {
    case "anonymous":
      return { href: signUpHref(CREATOR_APPLY_PATH), label: "creatorSpace.cta.anonymous" };
    case "member":
      return { href: CREATOR_APPLY_PATH, label: "creatorSpace.cta.member" };
    case "creator-pending":
      return { href: CREATOR_APPLY_PATH, label: "creatorSpace.cta.pending" };
    case "creator":
      return { href: CREATOR_UPLOAD_PATH, label: "creatorSpace.cta.creator" };
    case "suspended":
      return null;
  }
}

/** The tabs of the home feed (`?feed=`). */
export type FeedTab = "foryou" | "trending" | "vip" | "free" | "contacts";

/** Which empty state the home feed shows: nothing listed on the platform, or nothing in this tab. */
export type FeedEmptyKind = "platform" | "tab";

/**
 * The next steps under an empty home feed. Signed in, never the sign-up form: a fan explores, finds people or opens
 * their creator space; a pending creator follows their review; a creator publishes.
 */
export function feedEmptyActions(state: ViewerState, kind: FeedEmptyKind, tab: FeedTab): Cta[] {
  const creator = creatorSpaceCta(state);
  const explore: Cta = { href: "/explore", label: "feed.actions.explore" };
  if (state === "suspended") return [];
  if (kind === "platform") {
    if (state === "anonymous") return [{ href: signUpHref(), label: "feed.actions.join", primary: true }, creator!];
    if (state === "creator") return [{ ...creator!, primary: true }, explore];
    // A fan or a pending creator: look around, and the creator space (open it / its review).
    return [{ ...explore, primary: true }, creator!];
  }
  if (tab === "contacts") {
    if (state === "anonymous") return [{ href: signInHref("/?feed=contacts"), label: "feed.actions.signIn", primary: true }];
    return [
      { href: "/explore", label: "feed.actions.findPeople", primary: true },
      { href: "/dashboard?tab=network", label: "feed.actions.network" },
    ];
  }
  // "Paid" or "Free" with nothing in it: the other videos are one tap away.
  return [{ href: "/", label: "feed.actions.allVideos", primary: true }, explore];
}
