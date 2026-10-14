/**
 * The product recordings shown on the public pages — recorded on the real application (`npm run record:tour`) and kept
 * on Bunny (zone `krizaka-assets`, under `site/`), never in this repository. A file is `<name>.<hash>.<ext>`: its URL
 * never changes content, so it is cached for good. Hashes are those of krizaka.com's `lib/cdn-manifest.json`, where
 * the files were uploaded (`scripts/cdn-assets.mjs`). The pull zone is public.
 */

const CDN = "https://krizaka-assets.b-cdn.net/site";

const FILES: Record<string, string> = {
  "products/orochia/tour/alex-discover.webm": "9048b733c5",
  "products/orochia/tour/alex-discover.mp4": "f268fb3343",
  "products/orochia/tour/alex-discover.jpg": "2eee58b47b",
  "products/orochia/tour/alex-story.webm": "926bb489c5",
  "products/orochia/tour/alex-story.mp4": "50992f1b7b",
  "products/orochia/tour/alex-story.jpg": "a2e8d1f8a1",
  "products/orochia/tour/alex-unlock.webm": "cd0937de24",
  "products/orochia/tour/alex-unlock.mp4": "2a4c57e7de",
  "products/orochia/tour/alex-unlock.jpg": "3f0795e347",
  "products/orochia/tour/alex-bid.webm": "9cb93a4436",
  "products/orochia/tour/alex-bid.mp4": "9bf67a2d62",
  "products/orochia/tour/alex-bid.jpg": "aac2163c42",
  "products/orochia/tour/alex-back.webm": "00b1bc8e45",
  "products/orochia/tour/alex-back.mp4": "f43218bc90",
  "products/orochia/tour/alex-back.jpg": "52a1667232",
  "products/orochia/tour/elena-publish.webm": "806f868f3a",
  "products/orochia/tour/elena-publish.mp4": "d555728812",
  "products/orochia/tour/elena-publish.jpg": "915faf118f",
  "products/orochia/tour/elena-story.webm": "1204e33a8f",
  "products/orochia/tour/elena-story.mp4": "44d1cf5f84",
  "products/orochia/tour/elena-story.jpg": "301b8529b2",
  "products/orochia/tour/elena-earnings.webm": "0ddde3a17d",
  "products/orochia/tour/elena-earnings.mp4": "67cb22dbdb",
  "products/orochia/tour/elena-earnings.jpg": "df07763378",
  "products/orochia/tour/showcase.webm": "734760d782",
  "products/orochia/tour/showcase.mp4": "32ef6c97d8",
  "products/orochia/tour/showcase.jpg": "9e87cf7e04"
};

/** `products/orochia/tour/alex-bid.mp4` → `https://…/site/products/orochia/tour/alex-bid.<hash>.mp4`. */
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
export type TourClip = (typeof FAN_CLIPS)[number] | (typeof CREATOR_CLIPS)[number] | typeof SHOWCASE_CLIP;

export const tourRecording = (id: TourClip): Recording => recording(`products/orochia/tour/${id}`);
