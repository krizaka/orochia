/**
 * Does this video carry the Stream library's burned-in watermark? Bunny burns it at encoding, for new uploads only,
 * library-wide (scripts/bunny-library.mjs --watermark on, `MEDIA_WATERMARK_SINCE` = the day it was turned on). Those
 * videos already show the Orochia mark, so the player draws no second one; older videos keep the player's overlay.
 */
export function hasBurnedWatermark(createdAt: Date | string | null | undefined, since: string | null | undefined): boolean {
  if (!since || !createdAt) return false;
  const from = Date.parse(since);
  const created = new Date(createdAt).getTime();
  return Number.isFinite(from) && Number.isFinite(created) && created >= from;
}
