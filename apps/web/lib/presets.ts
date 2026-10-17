import manifest from "./presets.manifest.json";

export interface PresetAsset {
  id: string;
  /** The English alt text is also the name shown on hover; both languages live in the manifest. */
  name: string;
  alt: { en: string; fr: string };
  /** The family the picker groups it under (a key of AVATAR_FAMILIES or BANNER_FAMILIES). */
  family: string;
  url: string;
  /** The picker's thumbnail: a smaller file when the banner has an 800 px width, otherwise the same file. */
  thumbUrl: string;
}

/** Families in the order the picker shows them; the value is the message key suffix (settings.pictures.families.<key>). */
export const AVATAR_FAMILIES = { illustrated: "illustrated", painterly: "painterly", soft3d: "soft3d", line: "line", abstract: "abstract" } as const;
export const BANNER_FAMILIES = { abstract: "abstract", places: "places", textures: "textures", moods: "moods" } as const;

interface ManifestItem {
  id: string;
  family: string;
  alt: { en: string; fr: string };
  widths?: number[];
}

/**
 * Orochia's default avatars and banners, made by Orazaka (scripts/dev-dataset/profile-media*.json) and described by
 * `presets.manifest.json`: every identity, no stereotype, no real person. The files live in the product's storage zone under
 * `public/defaults/` and are served by the app itself at `/defaults/…` (app/defaults/[kind]/[file]/route.ts: it reads the zone
 * with the app's Referer, so the pull zone's hotlink protection never meets a browser or a native app without one).
 */
export const DEFAULT_AVATARS: PresetAsset[] = (manifest.avatars as ManifestItem[]).map((a) => ({
  id: a.id,
  name: a.alt.en,
  alt: a.alt,
  family: a.family,
  url: `/defaults/avatars/${a.id}-512.webp`,
  thumbUrl: `/defaults/avatars/${a.id}-256.webp`,
}));

export const DEFAULT_BANNERS: PresetAsset[] = (manifest.banners as ManifestItem[]).map((b) => ({
  id: b.id,
  name: b.alt.en,
  alt: b.alt,
  family: b.family,
  url: `/defaults/banners/${b.id}.webp`,
  thumbUrl: b.widths?.includes(800) ? `/defaults/banners/${b.id}-800.webp` : `/defaults/banners/${b.id}.webp`,
}));

/** The families a list really uses, in the declared order. */
export function familiesOf(kind: "avatar" | "banner", list: PresetAsset[]): string[] {
  const order = Object.keys(kind === "banner" ? BANNER_FAMILIES : AVATAR_FAMILIES);
  return order.filter((f) => list.some((p) => p.family === f));
}

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
