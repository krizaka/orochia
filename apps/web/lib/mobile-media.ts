/**
 * The recordings and screenshots of the Orochia mobile app (iOS simulator, Android emulator, the demo seed — Alex, a
 * fan, and Elena, a creator: invented people). Files are on the CDN under products/orochia/mobile (lib/site-media.ts);
 * the words are messages `mobile.*`. Nothing here says "live": the app plays recorded videos, stories and bids.
 */
import { siteMedia } from "./site-media";

export const MOBILE_CLIPS = ["age-gate", "feed-stories", "watch", "unlock", "challenge-auction", "messages", "sign-in"] as const;
export type MobileClip = (typeof MOBILE_CLIPS)[number];

export const MOBILE_SHOTS = [
  { id: "01-age-gate-dark", platform: "ios" },
  { id: "06-home-dark", platform: "ios" },
  { id: "06-home-light", platform: "ios" },
  { id: "07-story-dark", platform: "ios" },
  { id: "08-watch-dark", platform: "ios" },
  { id: "17-challenge-dark", platform: "ios" },
  { id: "17-challenge-light", platform: "ios" },
  { id: "18-auction-dark", platform: "ios" },
  { id: "16-sign-in-dark", platform: "ios" },
  { id: "05-account-earnings-dark", platform: "ios" },
  { id: "04-account-light", platform: "ios" },
  { id: "android-home", platform: "android" },
  { id: "android-account", platform: "android" },
] as const;
export type MobileShot = (typeof MOBILE_SHOTS)[number]["id"];

const AREA = "products/orochia/mobile";

export const mobileClip = (id: MobileClip) => ({
  webm: siteMedia(`${AREA}/clip-${id}.webm`),
  mp4: siteMedia(`${AREA}/clip-${id}.mp4`),
  poster: siteMedia(`${AREA}/clip-${id}-poster.webp`),
});

export const mobileShot = (id: MobileShot): string => siteMedia(`${AREA}/${id}.webp`);
