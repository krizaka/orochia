/**
 * The product recordings shown on the public pages — recorded on the real application (`npm run record:tour`) and kept
 * on Bunny (zone `krizaka-assets`, under `site/`), never in this repository. A file is `<name>.<hash>.<ext>`: its URL
 * never changes content, so it is cached for good. Hashes are those of krizaka.com's `lib/cdn-manifest.json`, where
 * the files were uploaded (`scripts/cdn-assets.mjs`). The pull zone is public.
 */

import type { Locale } from "./locales";

const CDN = "https://krizaka-assets.b-cdn.net/site";

const FILES: Record<string, string> = {
  "products/orochia/tour/en/alex-back.jpg": "96622aa2c4",
  "products/orochia/tour/en/alex-back.mp4": "6efb78f4d7",
  "products/orochia/tour/en/alex-back.webm": "217de009d7",
  "products/orochia/tour/en/alex-bid.jpg": "dfa61dba05",
  "products/orochia/tour/en/alex-bid.mp4": "bb98eec9da",
  "products/orochia/tour/en/alex-bid.webm": "d4fe23b5c7",
  "products/orochia/tour/en/alex-discover.jpg": "1587a53481",
  "products/orochia/tour/en/alex-discover.mp4": "c824cc9cb1",
  "products/orochia/tour/en/alex-discover.webm": "db227b2ffc",
  "products/orochia/tour/en/alex-story.jpg": "3c44174dc1",
  "products/orochia/tour/en/alex-story.mp4": "2db1da6a2b",
  "products/orochia/tour/en/alex-story.webm": "aec40108ec",
  "products/orochia/tour/en/alex-unlock.jpg": "207194802f",
  "products/orochia/tour/en/alex-unlock.mp4": "2f5870160e",
  "products/orochia/tour/en/alex-unlock.webm": "0535d8d82e",
  "products/orochia/tour/en/alex-watch.jpg": "a0b2b899f4",
  "products/orochia/tour/en/alex-watch.mp4": "72527aee6c",
  "products/orochia/tour/en/alex-watch.webm": "e88e5a294d",
  "products/orochia/tour/en/elena-earnings.jpg": "5272d51c8d",
  "products/orochia/tour/en/elena-earnings.mp4": "fcd745895d",
  "products/orochia/tour/en/elena-earnings.webm": "f2e4bb4b5e",
  "products/orochia/tour/en/elena-live.jpg": "0a41f19926",
  "products/orochia/tour/en/elena-live.mp4": "9a67407e1d",
  "products/orochia/tour/en/elena-live.webm": "7221859b4d",
  "products/orochia/tour/en/elena-publish.jpg": "357582ce0a",
  "products/orochia/tour/en/elena-publish.mp4": "ae5e777abc",
  "products/orochia/tour/en/elena-publish.webm": "24e8b8446c",
  "products/orochia/tour/en/elena-story.jpg": "56fcd7951c",
  "products/orochia/tour/en/elena-story.mp4": "8a6b9405d1",
  "products/orochia/tour/en/elena-story.webm": "20549708d8",
  "products/orochia/tour/en/showcase.jpg": "6c8b1a0bfc",
  "products/orochia/tour/en/showcase.mp4": "8d82f5419a",
  "products/orochia/tour/en/showcase.webm": "92bec0b594",
  "products/orochia/tour/fr/alex-back.jpg": "1e8868b70f",
  "products/orochia/tour/fr/alex-back.mp4": "3c511c8cd9",
  "products/orochia/tour/fr/alex-back.webm": "4194b5e88c",
  "products/orochia/tour/fr/alex-bid.jpg": "57ee3d4301",
  "products/orochia/tour/fr/alex-bid.mp4": "966ffe428b",
  "products/orochia/tour/fr/alex-bid.webm": "9d4888051d",
  "products/orochia/tour/fr/alex-discover.jpg": "c37f30fd8b",
  "products/orochia/tour/fr/alex-discover.mp4": "08782c0747",
  "products/orochia/tour/fr/alex-discover.webm": "16b7bcf425",
  "products/orochia/tour/fr/alex-story.jpg": "2ab1b98271",
  "products/orochia/tour/fr/alex-story.mp4": "cbbac10af8",
  "products/orochia/tour/fr/alex-story.webm": "0833951882",
  "products/orochia/tour/fr/alex-unlock.jpg": "92d7903a05",
  "products/orochia/tour/fr/alex-unlock.mp4": "e656ef1a47",
  "products/orochia/tour/fr/alex-unlock.webm": "870ff924c8",
  "products/orochia/tour/fr/alex-watch.jpg": "8afdb068fa",
  "products/orochia/tour/fr/alex-watch.mp4": "0199cb21b4",
  "products/orochia/tour/fr/alex-watch.webm": "3174d3b4d3",
  "products/orochia/tour/fr/elena-earnings.jpg": "bbc1d1c83c",
  "products/orochia/tour/fr/elena-earnings.mp4": "a07a74f4b0",
  "products/orochia/tour/fr/elena-earnings.webm": "ef73951b4e",
  "products/orochia/tour/fr/elena-live.jpg": "f5b1ea4e7b",
  "products/orochia/tour/fr/elena-live.mp4": "37225ff6a1",
  "products/orochia/tour/fr/elena-live.webm": "fa412fe7ff",
  "products/orochia/tour/fr/elena-publish.jpg": "e68cf56b9f",
  "products/orochia/tour/fr/elena-publish.mp4": "357079514b",
  "products/orochia/tour/fr/elena-publish.webm": "55470511ff",
  "products/orochia/tour/fr/elena-story.jpg": "93fd79739a",
  "products/orochia/tour/fr/elena-story.mp4": "7d0996d8dd",
  "products/orochia/tour/fr/elena-story.webm": "61f87f5b1c",
  "products/orochia/tour/fr/showcase.jpg": "6a01dbf847",
  "products/orochia/tour/fr/showcase.mp4": "0e267c3eae",
  "products/orochia/tour/fr/showcase.webm": "908d9f1951",
  "products/orochia/tour/en/home-phone.jpg": "555ef4cb6b",
  "products/orochia/tour/en/home-phone.mp4": "87f5ecc2d5",
  "products/orochia/tour/en/home-phone.webm": "d8b0da2948",
  "products/orochia/tour/fr/home-phone.jpg": "5a4163e0af",
  "products/orochia/tour/fr/home-phone.mp4": "378aaf39cc",
  "products/orochia/tour/fr/home-phone.webm": "6a1638d3c3",
  "products/orochia/mobile/clip-age-gate.webm": "1705767387",
  "products/orochia/mobile/clip-age-gate.mp4": "77f0c10471",
  "products/orochia/mobile/clip-age-gate-poster.webp": "d1a1e47ae8",
  "products/orochia/mobile/clip-feed-stories.webm": "32a0b4443d",
  "products/orochia/mobile/clip-feed-stories.mp4": "084ce2fd8b",
  "products/orochia/mobile/clip-feed-stories-poster.webp": "fd7835fa74",
  "products/orochia/mobile/clip-watch.webm": "f09b305a69",
  "products/orochia/mobile/clip-watch.mp4": "104cc14dd3",
  "products/orochia/mobile/clip-watch-poster.webp": "9fc5d19c39",
  "products/orochia/mobile/clip-unlock.webm": "1a22e53c94",
  "products/orochia/mobile/clip-unlock.mp4": "f6b20692fb",
  "products/orochia/mobile/clip-unlock-poster.webp": "57e13fee5f",
  "products/orochia/mobile/clip-challenge-auction.webm": "59c445d434",
  "products/orochia/mobile/clip-challenge-auction.mp4": "11f5793055",
  "products/orochia/mobile/clip-challenge-auction-poster.webp": "94c4d8e7e0",
  "products/orochia/mobile/clip-messages.webm": "70961efce8",
  "products/orochia/mobile/clip-messages.mp4": "d59c1961ff",
  "products/orochia/mobile/clip-messages-poster.webp": "4f50e13679",
  "products/orochia/mobile/clip-sign-in.webm": "a6a0fc3335",
  "products/orochia/mobile/clip-sign-in.mp4": "45d8952d50",
  "products/orochia/mobile/clip-sign-in-poster.webp": "a3124e54ce",
  "products/orochia/mobile/01-age-gate-dark.webp": "d726b8f556",
  "products/orochia/mobile/06-home-dark.webp": "79f01c0bf5",
  "products/orochia/mobile/06-home-light.webp": "9a3572b355",
  "products/orochia/mobile/07-story-dark.webp": "a195f81935",
  "products/orochia/mobile/08-watch-dark.webp": "c449b6ef16",
  "products/orochia/mobile/17-challenge-dark.webp": "41942ef84a",
  "products/orochia/mobile/17-challenge-light.webp": "d884f3b360",
  "products/orochia/mobile/18-auction-dark.webp": "aaae35aaa5",
  "products/orochia/mobile/16-sign-in-dark.webp": "21969a3622",
  "products/orochia/mobile/05-account-earnings-dark.webp": "28ce17d1a1",
  "products/orochia/mobile/04-account-light.webp": "85be02b33e",
  "products/orochia/mobile/android-home.webp": "e54d75548c",
  "products/orochia/mobile/android-account.webp": "b6d3b7981b"
};

/** `products/orochia/tour/fr/alex-bid.mp4` → `https://…/site/products/orochia/tour/fr/alex-bid.<hash>.mp4`. */
export function siteMedia(path: string): string {
  const hash = FILES[path];
  if (!hash) throw new Error(`${path} is not a known site recording`);
  const dot = path.lastIndexOf(".");
  return `${CDN}/${path.slice(0, dot)}.${hash}${path.slice(dot)}`;
}

/** A recording: the two encodings and its poster. */
export interface Recording {
  webm: string;
  mp4: string;
  poster: string;
}

export const recording = (base: string): Recording => ({
  webm: siteMedia(`${base}.webm`),
  mp4: siteMedia(`${base}.mp4`),
  poster: siteMedia(`${base}.jpg`),
});

/** Alex's side of the day (a fan) and Elena's (a creator), in the order they happen. */
export const FAN_CLIPS = ["alex-discover", "alex-story", "alex-unlock", "alex-bid", "alex-back"] as const;
export const CREATOR_CLIPS = ["elena-publish", "elena-story", "elena-earnings"] as const;
export const SHOWCASE_CLIP = "showcase";
/** The watch page on its own (the home's step 2, the journey's « watch »); the other clips are the day's moments above. */
export const WATCH_CLIP = "alex-watch";
/** The home's one continuous phone take of dev.orochia.com (`scripts/record-home-phone.mjs`), one per language. */
export const HOME_TAKE = "home-phone";
export type TourClip = (typeof FAN_CLIPS)[number] | (typeof CREATOR_CLIPS)[number] | typeof SHOWCASE_CLIP | typeof WATCH_CLIP | typeof HOME_TAKE;

/** Every clip is recorded once per language (`npm run record:tour`): the interface in the clip is the reader's. */
export const tourRecording = (id: TourClip, locale: Locale): Recording => recording(`products/orochia/tour/${locale}/${id}`);
