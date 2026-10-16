/**
 * What an encoded video really is, from what Bunny Stream read (never guessed): the picture's size, its renditions
 * (`availableResolutions`, named by the short side) and its frame rate. The quality is the best rendition that exists.
 */
export type QualityTier = "SD" | "HD" | "2K" | "4K";

export interface VideoQuality {
  tier: QualityTier;
  /** The short side of the best rendition: 480, 720, 1080… */
  lines: number;
  /** `HD 720p`, `SD 480p`, `4K 2160p`. */
  label: string;
}

/** The best rendition in `["480p", "360p"]`, else the short side of the picture itself. Null while nothing is known. */
export function bestLines(resolutions?: string[] | null, width?: number | null, height?: number | null): number | null {
  const fromRenditions = (resolutions ?? []).map((r) => Number.parseInt(r, 10)).filter((n) => Number.isFinite(n) && n > 0);
  if (fromRenditions.length > 0) return Math.max(...fromRenditions);
  if (width && height && width > 0 && height > 0) return Math.min(width, height);
  return null;
}

export function qualityOf(resolutions?: string[] | null, width?: number | null, height?: number | null): VideoQuality | null {
  const lines = bestLines(resolutions, width, height);
  if (lines === null) return null;
  const tier: QualityTier = lines >= 2160 ? "4K" : lines >= 1440 ? "2K" : lines >= 720 ? "HD" : "SD";
  return { tier, lines, label: `${tier} ${lines}p` };
}

/** `16:9`, `9:16`, `1:1`, `4:5`: the picture's shape, named (the nearest common ratio), or its reduced ratio. */
export function aspectLabel(width?: number | null, height?: number | null): string | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const r = width / height;
  const known: [string, number][] = [["16:9", 16 / 9], ["9:16", 9 / 16], ["1:1", 1], ["4:5", 4 / 5], ["5:4", 5 / 4], ["4:3", 4 / 3], ["3:4", 3 / 4], ["21:9", 21 / 9]];
  const best = known.reduce((a, b) => (Math.abs(b[1] - r) < Math.abs(a[1] - r) ? b : a));
  return Math.abs(best[1] - r) / r < 0.04 ? best[0] : `${width}:${height}`;
}
