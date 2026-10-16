export interface PresetAsset {
  id: string;
  name: string;
  url: string;
}

/**
 * Orochia's default avatars and banners, made by Orazaka (scripts/dev-dataset/profile-media.json): every identity, no
 * stereotype, no real person. The files live in the product's storage zone under `public/defaults/` and are served by
 * the app itself at `/defaults/…` (app/defaults/[kind]/[file]/route.ts: it reads the zone with the app's Referer, so the
 * pull zone's hotlink protection never meets a browser or a native app without one).
 */
export const DEFAULT_AVATARS: PresetAsset[] = [
  { id: "aurora-1", name: "Aurora orb", url: "/defaults/avatars/aurora-1-512.webp" },
  { id: "aurora-2", name: "Ribbon light", url: "/defaults/avatars/aurora-2-512.webp" },
  { id: "painterly-1", name: "Oil portrait", url: "/defaults/avatars/painterly-1-512.webp" },
  { id: "painterly-2", name: "Silver beard", url: "/defaults/avatars/painterly-2-512.webp" },
  { id: "graphic-1", name: "Ink undercut", url: "/defaults/avatars/graphic-1-512.webp" },
  { id: "graphic-2", name: "Ink and wheels", url: "/defaults/avatars/graphic-2-512.webp" },
  { id: "graphic-3", name: "Violet halftone", url: "/defaults/avatars/graphic-3-512.webp" },
  { id: "clay-1", name: "Clay, grown-up", url: "/defaults/avatars/clay-1-512.webp" },
  { id: "clay-2", name: "Clay, long waves", url: "/defaults/avatars/clay-2-512.webp" },
  { id: "clay-3", name: "Clay, red curls", url: "/defaults/avatars/clay-3-512.webp" },
  { id: "line-1", name: "Line wave", url: "/defaults/avatars/line-1-512.webp" },
  { id: "line-2", name: "Line scarf", url: "/defaults/avatars/line-2-512.webp" },
  { id: "zine-1", name: "Zine afro", url: "/defaults/avatars/zine-1-512.webp" },
  { id: "zine-2", name: "Zine beads", url: "/defaults/avatars/zine-2-512.webp" },
  { id: "painterly-4", name: "Gold light", url: "/defaults/avatars/painterly-4-512.webp" },
];

export const DEFAULT_BANNERS: PresetAsset[] = [
  { id: "light-1", name: "Violet light", url: "/defaults/banners/light-1.webp" },
  { id: "light-2", name: "Indigo waves", url: "/defaults/banners/light-2.webp" },
  { id: "texture-1", name: "Paper layers", url: "/defaults/banners/texture-1.webp" },
  { id: "mural-1", name: "Mural colours", url: "/defaults/banners/mural-1.webp" },
  { id: "stairs-1", name: "Plateau stairs", url: "/defaults/banners/stairs-1.webp" },
  { id: "neon-1", name: "Mile-End alley", url: "/defaults/banners/neon-1.webp" },
  { id: "skyline-1", name: "Skyline dusk", url: "/defaults/banners/skyline-1.webp" },
  { id: "mural-2", name: "Brick geometry", url: "/defaults/banners/mural-2.webp" },
  { id: "aurora-3", name: "Northern lights", url: "/defaults/banners/aurora-3.webp" },
];

/** The presets the profile settings offer. */
export function getPresetAssets(): { avatars: PresetAsset[]; banners: PresetAsset[] } {
  return { avatars: DEFAULT_AVATARS, banners: DEFAULT_BANNERS };
}

/** FNV-1a: a stable number from any string. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The default avatar of a person without a photo: random but stable (the same seed always gets the same one). */
export function defaultAvatarFor(seed: string, size: 256 | 512 = 256): string {
  const preset = DEFAULT_AVATARS[hash(seed || "?") % DEFAULT_AVATARS.length];
  return preset.url.replace("-512.webp", `-${size}.webp`);
}

/** The default banner of a profile without a cover, stable for the same seed. */
export function defaultBannerFor(seed: string): string {
  return DEFAULT_BANNERS[hash(seed || "?") % DEFAULT_BANNERS.length].url;
}

/** A picture address that is safe to put in `src`: an http(s) URL or a path of the app — anything else (javascript:, data:) is dropped. */
export function safeImageSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return undefined;
}
