/**
 * How the home feed is laid out. On a phone (< 640 px) it is a vertical, full-screen, snap-scrolling feed — one video per
 * screen — unless the address asks for the grid (`?view=grid`); tablets and desktops keep the grid and the Shorts shelf.
 * Pure, so the rule is a unit test.
 */
export const PHONE_QUERY = "(max-width: 639px)";

export const FeedLayout = { Vertical: "vertical", Grid: "grid" } as const;
export type FeedLayout = (typeof FeedLayout)[keyof typeof FeedLayout];

export function feedLayoutOf({ phone, view }: { phone: boolean; view: string | null | undefined }): FeedLayout {
  return phone && view !== FeedLayout.Grid ? FeedLayout.Vertical : FeedLayout.Grid;
}

/** The address of the other layout: the grid is `?view=grid`, the vertical feed is the bare address. */
export function viewSearch(current: URLSearchParams, layout: FeedLayout): URLSearchParams {
  const next = new URLSearchParams(current);
  if (layout === FeedLayout.Grid) next.set("view", FeedLayout.Grid);
  else next.delete("view");
  return next;
}

/** Whether a slide may load and play its video: never under Save-Data (posters only), and the kit stills it under reduced motion. */
export function mayStream({ saveData, reducedMotion }: { saveData: boolean; reducedMotion: boolean }): boolean {
  return !saveData && !reducedMotion;
}
