/**
 * Orientation of a video, from the source picture's size at Bunny (stored when encoding ends). Orochia is mobile first:
 * a vertical clip (9:16, 4:5) is shown vertical, a square one square, a horizontal one 16:9 — never letterboxed or
 * cropped into somebody else's box. Unknown (not encoded yet, or encoded before sizes were kept) counts as horizontal.
 */
export type VideoOrientation = "vertical" | "square" | "horizontal";

export function orientationOf(width?: number | null, height?: number | null): VideoOrientation {
  if (!width || !height || width <= 0 || height <= 0) return "horizontal";
  const ratio = width / height;
  if (ratio < 0.9) return "vertical";
  if (ratio <= 1.1) return "square";
  return "horizontal";
}

/** Literal class names (Tailwind reads the source) for the box a picture of this orientation fills. */
export const ASPECT_CLASS: Record<VideoOrientation, string> = {
  vertical: "aspect-[9/16]",
  square: "aspect-square",
  horizontal: "aspect-video",
};

export const aspectClassOf = (width?: number | null, height?: number | null) => ASPECT_CLASS[orientationOf(width, height)];

/**
 * The format of a video — the one rule every list reads: a vertical clip (9:16) up to `shortsMaxSeconds` is a Short; a
 * square (1:1) or horizontal (16:9) one, an unknown size, or a vertical clip longer than the limit is a Video.
 */
export type VideoFormat = "short" | "video";

export function formatOf(width: number | null | undefined, height: number | null | undefined, durationSeconds: number, shortsMaxSeconds: number): VideoFormat {
  return orientationOf(width, height) === "vertical" && durationSeconds <= shortsMaxSeconds ? "short" : "video";
}

/** The kit's frame for a source: a Short fills 9:16 (the Shorts shelf), anything else 16:9. */
export const frameOf = (width?: number | null, height?: number | null, durationSeconds = 0, shortsMaxSeconds = Number.POSITIVE_INFINITY): "portrait" | "landscape" =>
  formatOf(width, height, durationSeconds, shortsMaxSeconds) === "short" ? "portrait" : "landscape";

/**
 * How a picture fills its tile: always cover (a square clip is cropped to the 16:9 tile around its centre, never letterboxed
 * with side bars) — except a vertical clip that is not a Short, whose slice would show nothing: it is drawn whole.
 */
export const tileFitOf = (width: number | null | undefined, height: number | null | undefined, frame: "portrait" | "landscape"): "cover" | "contain" =>
  frame === "landscape" && orientationOf(width, height) === "vertical" ? "contain" : "cover";
