import type { TourClip } from "@/lib/site-media";

/**
 * A signed-out visitor's home — its structure; the words are messages `home.visitor.*`. One story in five sections:
 * the promise with the real app playing, the real feed as a visitor sees it, how it works, the creator side, the way in.
 * A member, or a visitor who opens a feed tab (`?feed=…`), gets the feed itself.
 */
export const VISITOR_SECTIONS = ["hero", "preview", "how", "creators", "closing"] as const;

/** The hero's journey: the real recordings of the demo personas (Alex, a fan; Elena, a creator) on the app. */
export const HERO_STEPS = [
  { id: "find", clip: "alex-discover" },
  { id: "watch", clip: "showcase" },
  { id: "tip", clip: "alex-story" },
  { id: "earn", clip: "elena-earnings" },
] as const satisfies readonly { id: string; clip: TourClip }[];

/** How it works, in three steps; the whole journey is /how-it-works. */
export const HOW_STEPS = ["find", "choose", "support"] as const;

// @fixed: a layout choice (two rows of four tiles on a desktop), not a business parameter.
export const PREVIEW_SIZE = 8;
