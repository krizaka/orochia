/**
 * What an encoded video really is, from what Bunny Stream read (never guessed): the picture's size, its renditions
 * (`availableResolutions`, named by the short side) and its frame rate. The quality is the best rendition that exists.
 */
export type QualityTier = "FHD" | "QHD" | "4K";

export interface VideoQuality {
  tier: QualityTier;
  /** The standard line count of the tier: 1080, 1440 or 2160. */
  lines: number;
  /** `Full HD 1080p`, `QHD 1440p`, `4K` (technical names: the same in every language). */
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

/**
 * Thresholds on the short side, the one place the rule lives (web cards, the watch page; the mobile app has the same
 * table). Slack of one multiple of 16 for encoders that round down: 1072 is Full HD, 1424 QHD, 2144 4K.
 */
export const QUALITY_THRESHOLDS = { fhd: 1072, qhd: 1424, uhd: 2144 } as const;

/**
 * The one badge of a video, the same on the home, Explore, the watch page and every card. Only what is really above HD
 * earns one: below 1080p there is no badge (720p is never sold as « HD »).
 */
export function qualityOf(resolutions?: string[] | null, width?: number | null, height?: number | null): VideoQuality | null {
  const side = bestLines(resolutions, width, height);
  if (side === null) return null;
  if (side >= QUALITY_THRESHOLDS.uhd) return { tier: "4K", lines: 2160, label: "4K" };
  if (side >= QUALITY_THRESHOLDS.qhd) return { tier: "QHD", lines: 1440, label: "QHD 1440p" };
  if (side >= QUALITY_THRESHOLDS.fhd) return { tier: "FHD", lines: 1080, label: "Full HD 1080p" };
  return null;
}

/** `16:9`, `9:16`, `1:1`, `4:5`: the picture's shape, named (the nearest common ratio), or its reduced ratio. */
export function aspectLabel(width?: number | null, height?: number | null): string | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const r = width / height;
  const known: [string, number][] = [["16:9", 16 / 9], ["9:16", 9 / 16], ["1:1", 1], ["4:5", 4 / 5], ["5:4", 5 / 4], ["4:3", 4 / 3], ["3:4", 3 / 4], ["21:9", 21 / 9]];
  const best = known.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a));
  return Math.abs(best[1] - r) / r < 0.04 ? best[0] : `${width}:${height}`;
}
