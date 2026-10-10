/**
 * What Explore may show — the rules, pure, so every leak case is a unit test (lib/discoverable.test.ts); the SQL of
 * lib/explore.ts is built from the same constants.
 *
 * Discovery is public only. A video or a story reaches Explore (its sections, its search, its tags, the search
 * palette) when **everyone** may see it: `PUBLIC`, ready, not taken down, from an active account, and not held for an
 * unresolved report of a suspected minor or of non-consensual content (§3.E: triaged first; out of discovery until an
 * operator resolves it). Followers-only, contacts-only, close friends (invited / audience lists), paid unlocks,
 * auctioned and challenge content never appear — not even to the people allowed to watch it: they find it on the
 * creator's profile, where the access rules of lib/access.ts apply. A story also has to be live (not expired).
 *
 * Auctions and challenges are listings, not media: Explore shows the open ones exactly as /auctions and /challenges do.
 */

export const DISCOVERABLE_VISIBILITY = "PUBLIC" as const;
/** Reports that take content out of discovery until an operator resolves them. */
export const HOLDING_REPORT_REASONS = ["UNDERAGE", "NON_CONSENSUAL"] as const;
export const UNRESOLVED_REPORT_STATUSES = ["OPEN", "IN_REVIEW"] as const;

export interface DiscoveryFacts {
  visibility: string;
  status: string;
  removedAt: Date | null;
  creatorSuspended: boolean;
  /** An unresolved UNDERAGE / NON_CONSENSUAL report names it. */
  heldForReview: boolean;
}

export function isDiscoverableVideo(v: DiscoveryFacts): boolean {
  return v.visibility === DISCOVERABLE_VISIBILITY && v.status === "READY" && v.removedAt === null && !v.creatorSuspended && !v.heldForReview;
}

export function isDiscoverableStory(s: DiscoveryFacts & { expiresAt: Date }, now: Date): boolean {
  return isDiscoverableVideo(s) && s.expiresAt.getTime() > now.getTime();
}

/** A creator suggested in Explore: an active, verified creator space with at least one discoverable video or story. */
export function isDiscoverableCreator(c: { role: string; isVerified: boolean; suspended: boolean; discoverableItems: number }): boolean {
  return (c.role === "CREATOR" || c.role === "ADMIN") && c.isVerified && !c.suspended && c.discoverableItems > 0;
}

/**
 * The 18+ gate on a picture in Explore: veiled (blurred until the viewer reveals it) when the creator asked for it or
 * its rating requires it — for everyone —, and when its rating is adult for a visitor whose age the server has not
 * checked (not signed in: the age gate is only the visitor's word). Signed-in accounts were checked 18+ by the server
 * at registration (`checkDateOfBirth`).
 */
export function isVeiled(item: { isBlurred: boolean; ratingRequiresBlur: boolean; ratingIsAdult: boolean }, viewerAgeChecked: boolean): boolean {
  if (item.isBlurred || item.ratingRequiresBlur) return true;
  return item.ratingIsAdult && !viewerAgeChecked;
}
