import { isVeiled } from "./discoverable";

/** The rating facts a list query selects next to a video (`contentRatings` joined on `videos.contentRatingId`). */
export interface RatingFacts {
  isBlurred: boolean;
  ratingRequiresBlur: boolean;
  ratingIsAdult: boolean;
}

/**
 * The 18+ veil of a video in any list (feed, home, profile): the row without its rating columns, with `isBlurred` (the
 * veil, lib/discoverable.ts `isVeiled`) and `isAdult` (the 18+ badge). `viewerAgeChecked` is the server's check of the
 * viewer's age — false for a visitor and for an account that never gave a date of birth.
 */
export function veilSummary<T extends RatingFacts>(row: T, viewerAgeChecked: boolean): Omit<T, "ratingRequiresBlur" | "ratingIsAdult"> & { isBlurred: boolean; isAdult: boolean } {
  const { ratingRequiresBlur, ratingIsAdult, ...rest } = row;
  return { ...rest, isBlurred: isVeiled(row, viewerAgeChecked), isAdult: ratingIsAdult };
}

/** For a card with no blur of its own: the picture, or null (the card's fallback) while the veil applies to this viewer. */
export function unveiledThumbnail(url: string | null, facts: RatingFacts, viewerAgeChecked: boolean): string | null {
  return isVeiled(facts, viewerAgeChecked) ? null : url;
}
