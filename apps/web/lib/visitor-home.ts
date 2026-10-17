import type { Locale } from "@/lib/locales";
import type { TourClip } from "@/lib/site-media";

/**
 * A signed-out visitor's home — its structure; the words are messages `home.visitor.*`. One story in five sections:
 * the promise with the real app playing, the real feed as a visitor sees it, how it works, the creator side, the way in.
 * A member, or a visitor who opens a feed tab (`?feed=…`), gets the feed itself.
 */
export const VISITOR_SECTIONS = ["hero", "preview", "how", "creators", "closing"] as const;

/**
 * The hero's journey: four steps over ONE continuous take of the real app on a phone (`scripts/record-home-phone.mjs`
 * prints the beats): the vertical feed, her story, the tip, her earnings.
 */
export const HERO_STEPS = [{ id: "find" }, { id: "watch" }, { id: "tip" }, { id: "earn" }] as const;
export const HERO_CLIP: TourClip = "home-phone";

/** Seconds at which each step of the take starts, per language (the recorder's `beats.json`); the take lasts `TAKE_SECONDS`. */
export const TAKE_BEATS: Record<Locale, readonly number[]> = { en: [0, 6.5, 12.7, 18], fr: [0, 6.6, 13.1, 18.4] };
// @fixed: the take's length is a fact of the recording, checked by a test against the beats.
export const TAKE_SECONDS = 23;

/** How it works, in three steps; the whole journey is /how-it-works. */
export const HOW_STEPS = ["find", "choose", "support"] as const;

// @fixed: a layout choice (two rows of four tiles on a desktop), not a business parameter.
export const PREVIEW_SIZE = 8;
