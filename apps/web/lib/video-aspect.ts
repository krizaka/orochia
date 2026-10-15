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
