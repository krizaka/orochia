/**
 * What an edit is — plain data shared by the editor (browser) and the drafts API (server), which stores
 * it with a draft. The rendering lives in video-edit.ts.
 */

/** Each look: the exact ffmpeg chain for the export, and its CSS approximation for the live preview. */
export const VIDEO_FILTERS = {
  none: { ffmpeg: "", css: "" },
  vivid: { ffmpeg: "eq=saturation=1.45:contrast=1.08", css: "saturate(1.45) contrast(1.08)" },
  warm: { ffmpeg: "colorbalance=rs=0.12:gs=0.02:bs=-0.12", css: "sepia(0.25) saturate(1.2)" },
  cool: { ffmpeg: "colorbalance=rs=-0.1:bs=0.14", css: "hue-rotate(12deg) saturate(1.1)" },
  golden: { ffmpeg: "colorbalance=rs=0.15:gs=0.08:bs=-0.15,eq=saturation=1.2:brightness=0.03", css: "sepia(0.35) saturate(1.4) brightness(1.05)" },
  cinematic: { ffmpeg: "colorbalance=rs=-0.1:bs=0.12:rh=0.12:bh=-0.1,eq=contrast=1.15:saturation=1.1", css: "contrast(1.15) saturate(1.2) hue-rotate(-8deg)" },
  faded: { ffmpeg: "eq=contrast=0.85:brightness=0.05:saturation=0.8", css: "contrast(0.85) brightness(1.05) saturate(0.8)" },
  dramatic: { ffmpeg: "eq=contrast=1.35:saturation=1.1:brightness=-0.04,vignette", css: "contrast(1.35) saturate(1.1) brightness(0.95)" },
  dreamy: { ffmpeg: "gblur=sigma=1.2,eq=brightness=0.06:saturation=1.15", css: "blur(1px) brightness(1.08) saturate(1.15)" },
  neon: { ffmpeg: "hue=h=40:s=1.6", css: "hue-rotate(40deg) saturate(1.6)" },
  sepia: { ffmpeg: "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131", css: "sepia(1)" },
  mono: { ffmpeg: "hue=s=0", css: "grayscale(1)" },
  noir: { ffmpeg: "hue=s=0,eq=contrast=1.45:brightness=-0.05", css: "grayscale(1) contrast(1.45) brightness(0.95)" },
  vintage: { ffmpeg: "curves=preset=vintage", css: "sepia(0.45) contrast(0.95) saturate(0.85)" },
} as const;
export type VideoFilter = keyof typeof VIDEO_FILTERS;

export type VideoFormat = "original" | "vertical" | "square";
export const SPEEDS = [0.5, 1, 1.5, 2] as const;
export type Speed = (typeof SPEEDS)[number];

export interface VideoEdit {
  startSeconds: number;
  endSeconds: number;
  speed: Speed;
  filter: VideoFilter;
  /** Fine tuning on top of the filter, each −0.5…+0.5 (0 = untouched). */
  brightness: number;
  contrast: number;
  saturation: number;
  /** Frame: keep the original, or crop to a vertical 9:16 (stories) or a square. */
  format: VideoFormat;
  /** Which part stays in when cropping, 0–1 on each axis (0.5 = centre). */
  focusX: number;
  focusY: number;
  /** Original sound volume, 0 (muted) … 2 (doubled). */
  volume: number;
  fadeIn: boolean;
  fadeOut: boolean;
  /** Reduces steady background noise (wind, hum, fan). */
  denoise: boolean;
  /** A track mixed under the video (looped if shorter), and its volume 0…1. */
  music: File | null;
  musicVolume: number;
}

export const DEFAULT_EDIT: Omit<VideoEdit, "startSeconds" | "endSeconds"> = {
  speed: 1,
  filter: "none",
  brightness: 0,
  contrast: 0,
  saturation: 0,
  format: "original",
  focusX: 0.5,
  focusY: 0.5,
  volume: 1,
  fadeIn: false,
  fadeOut: false,
  denoise: false,
  music: null,
  musicVolume: 0.6,
};

/** The live preview of filter + adjustments (approximate; the export is exact). */
export function previewFilter(edit: Pick<VideoEdit, "filter" | "brightness" | "contrast" | "saturation">): string | undefined {
  const parts = [
    VIDEO_FILTERS[edit.filter].css,
    edit.brightness ? `brightness(${(1 + edit.brightness).toFixed(2)})` : "",
    edit.contrast ? `contrast(${(1 + edit.contrast).toFixed(2)})` : "",
    edit.saturation ? `saturate(${(1 + edit.saturation).toFixed(2)})` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

/** The settings a draft stores (everything but the music file, which is kept beside it). */
export type StoredEdit = Omit<VideoEdit, "music">;

const unit = (min: number, max: number) => ({ min, max });
const RANGES = { brightness: unit(-0.5, 0.5), contrast: unit(-0.5, 0.5), saturation: unit(-0.5, 0.5), focusX: unit(0, 1), focusY: unit(0, 1), volume: unit(0, 2), musicVolume: unit(0, 1) };

/** Checks settings coming from a client; null when they are not an edit this editor can make. */
export function parseStoredEdit(value: unknown): StoredEdit | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const num = (k: string) => (typeof v[k] === "number" && Number.isFinite(v[k]) ? (v[k] as number) : NaN);
  const start = num("startSeconds");
  const end = num("endSeconds");
  if (!(start >= 0) || !(end > start)) return null;
  if (!SPEEDS.includes(v.speed as Speed) || !(typeof v.filter === "string" && v.filter in VIDEO_FILTERS)) return null;
  if (!["original", "vertical", "square"].includes(v.format as string)) return null;
  for (const [k, r] of Object.entries(RANGES)) if (!(num(k) >= r.min && num(k) <= r.max)) return null;
  if (![v.fadeIn, v.fadeOut, v.denoise].every((b) => typeof b === "boolean")) return null;
  return {
    startSeconds: start,
    endSeconds: end,
    speed: v.speed as Speed,
    filter: v.filter as VideoFilter,
    brightness: num("brightness"),
    contrast: num("contrast"),
    saturation: num("saturation"),
    format: v.format as VideoFormat,
    focusX: num("focusX"),
    focusY: num("focusY"),
    volume: num("volume"),
    fadeIn: v.fadeIn as boolean,
    fadeOut: v.fadeOut as boolean,
    denoise: v.denoise as boolean,
    musicVolume: num("musicVolume"),
  };
}
