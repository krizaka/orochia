/**
 * What an encoded video really is, from what Bunny Stream read (never guessed): the picture's size, its renditions
 * (`availableResolutions`, named by the short side) and its frame rate. The quality is the best rendition that exists.
 */
export type QualityTier = "SD" | "HD" | "FHD" | "4K";

export interface VideoQuality {
  tier: QualityTier;
  /** The standard line count of the tier: the real short side for SD (480, 360…), 720, 1080 or 2160 above. */
  lines: number;
  /** `HD 720p`, `Full HD 1080p`, `4K 2160p`, `SD 480p`. */
  label: string;
}

/**
 * The short side of the real file. The picture's own size is the truth; the renditions Bunny lists (`["720p", "480p"]`)
 * are only read when the size is unknown (a list that carries no size must say what the card of another page says).
 */
export function bestLines(resolutions?: string[] | null, width?: number | null, height?: number | null): number | null {
  if (width && height && width > 0 && height > 0) return Math.min(width, height);
  const fromRenditions = (resolutions ?? []).map((r) => Number.parseInt(r, 10)).filter((n) => Number.isFinite(n) && n > 0);
  return fromRenditions.length > 0 ? Math.max(...fromRenditions) : null;
}

/** Thresholds are on the short side, with the slack of encoders that round to a multiple of 16: 704 is HD 720p, never SD. */
export const QUALITY_THRESHOLDS = { hd: 700, fhd: 1000, uhd: 2000 } as const;

/** The one badge of a video, the same on the home, Explore, the watch page and every card. */
export function qualityOf(resolutions?: string[] | null, width?: number | null, height?: number | null): VideoQuality | null {
  const side = bestLines(resolutions, width, height);
  if (side === null) return null;
  if (side >= QUALITY_THRESHOLDS.uhd) return { tier: "4K", lines: 2160, label: "4K 2160p" };
  if (side >= QUALITY_THRESHOLDS.fhd) return { tier: "FHD", lines: 1080, label: "Full HD 1080p" };
  if (side >= QUALITY_THRESHOLDS.hd) return { tier: "HD", lines: 720, label: "HD 720p" };
  return { tier: "SD", lines: side, label: `SD ${side}p` };
}

/** `16:9`, `9:16`, `1:1`, `4:5`: the picture's shape, named (the nearest common ratio), or its reduced ratio. */
export function aspectLabel(width?: number | null, height?: number | null): string | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const r = width / height;
  const known: [string, number][] = [["16:9", 16 / 9], ["9:16", 9 / 16], ["1:1", 1], ["4:5", 4 / 5], ["5:4", 5 / 4], ["4:3", 4 / 3], ["3:4", 3 / 4], ["21:9", 21 / 9]];
  const best = known.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a));
  return Math.abs(best[1] - r) / r < 0.04 ? best[0] : `${width}:${height}`;
}
