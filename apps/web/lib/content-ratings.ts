/**
 * The content ratings that are 18+, by the ids of the reference data (`content_ratings`: FOR_KIDS, GENERAL, TEEN,
 * MATURE, ADULT). One list for every badge and player: a component never spells a rating id itself.
 */
export const ADULT_RATING_IDS = ["MATURE", "ADULT"] as const;

export function isAdultRating(id: string | null | undefined): boolean {
  return id != null && (ADULT_RATING_IDS as readonly string[]).includes(id);
}
