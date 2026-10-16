import { isAdultRating } from "./content-ratings";

/**
 * 18+ content is gated by the server. The visitor's own word (the browser's `orochia_age_verified` flag) opens nothing:
 * a MATURE / ADULT item (the shared list, lib/content-ratings.ts) plays, unlocks, takes bids, pledges, downloads and
 * details beyond its veiled summary only for a signed-in account whose age the server has checked (`isAgeVerified`:
 * date of birth, 18+). Its author always can. The rule is this function; lib/access.ts applies it everywhere.
 */
export const AGE_CHECK_REQUIRED = "content.age_check_required";

export interface AdultViewer {
  id: string;
  isAgeVerified: boolean;
}

export function adultAccessAllowed(input: {
  contentRatingId: string | null | undefined;
  creatorId: string;
  viewer: AdultViewer | null | undefined;
}): boolean {
  if (!isAdultRating(input.contentRatingId)) return true;
  if (!input.viewer) return false;
  return input.viewer.id === input.creatorId || input.viewer.isAgeVerified === true;
}
