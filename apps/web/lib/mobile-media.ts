/**
 * The four steps of the Orochia mobile app, in the order a fan meets them: the 18+ gate, the feed and stories,
 * unlocking a video, a goal and an auction. Each step is one recording (iOS simulator, the demo seed — Alex, a fan,
 * and Elena, a creator: invented people). Files are on the CDN under products/orochia/mobile (lib/site-media.ts);
 * the words — goal, purpose, alt, the things to notice — are messages `mobile.steps.<id>`. Nothing here says "live":
 * the app plays recorded videos, stories and bids. Fewer screens, each one explained.
 */
import { siteMedia } from "./site-media";

export const MOBILE_STEPS = ["age-gate", "feed-stories", "unlock", "challenge-auction"] as const;
export type MobileStep = (typeof MOBILE_STEPS)[number];

const AREA = "products/orochia/mobile";

export const mobileClip = (id: MobileStep) => ({
  webm: siteMedia(`${AREA}/clip-${id}.webm`),
  mp4: siteMedia(`${AREA}/clip-${id}.mp4`),
  poster: siteMedia(`${AREA}/clip-${id}-poster.webp`),
});
