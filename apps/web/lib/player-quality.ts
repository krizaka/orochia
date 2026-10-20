/**
 * The player's quality picker, as data: the renditions of the stream become a menu (`levelOptions`), a choice becomes a
 * switch (`applyQuality`) and is kept for the session (`storeQuality`). Pure — the component only draws it.
 *
 * A rendition is named by its short side (Bunny's `availableResolutions`: a 1080×1920 clip is `1080p`), and wears a
 * badge only from Full HD up, the same rule as every card (`lib/video-quality.ts`). hls.js answers `levels`; iPhone
 * Safari's native HLS has no such API, so the master playlist is read for its variants instead (`parseMasterPlaylist`).
 */
import { QUALITY_THRESHOLDS } from "@/lib/video-quality";

/** The id of « Auto » (adaptive); a rendition's id is its short side in lines (`"720"`). */
export const AUTO = "auto";
/** `sessionStorage`: the choice lasts for the session, never longer, never sent anywhere. */
export const QUALITY_STORAGE_KEY = "kz-orochia-quality";

export interface QualityOption {
  id: string;
  /** `Auto`, `1080p`… (technical names, the same in every language; the component words « Auto »). */
  label: string;
  /** The short side in lines; null for Auto. */
  height: number | null;
  /** `HD`, `QHD`, `4K` from Full HD up, never below. */
  badge: string | null;
  /** hls.js level index (-1 = Auto); for native HLS, the index in the variants. */
  level: number;
}

export interface LevelLike {
  width?: number;
  height: number;
  bitrate?: number;
}

/** What of hls.js the picker touches (a test hands a fake). */
export interface HlsLike {
  levels: LevelLike[];
  currentLevel: number;
  autoLevelEnabled?: boolean;
}

const shortSide = (l: LevelLike) => (l.width && l.width > 0 ? Math.min(l.width, l.height) : l.height);

/** `HD` ≥ 1080, `QHD` ≥ 1440, `4K` ≥ 2160 (with the thresholds' slack); nothing below Full HD. */
export function qualityBadge(lines: number): string | null {
  if (lines >= QUALITY_THRESHOLDS.uhd) return "4K";
  if (lines >= QUALITY_THRESHOLDS.qhd) return "QHD";
  if (lines >= QUALITY_THRESHOLDS.fhd) return "HD";
  return null;
}

const AUTO_OPTION: QualityOption = { id: AUTO, label: "Auto", height: null, badge: null, level: -1 };

/** Auto, then each rendition best to worst (one per height — the richest bitrate). Empty when the stream has none. */
export function levelOptions(levels: LevelLike[]): QualityOption[] {
  const best = new Map<number, { index: number; bitrate: number }>();
  levels.forEach((l, index) => {
    const lines = shortSide(l);
    if (!(lines > 0)) return;
    const bitrate = l.bitrate ?? 0;
    const known = best.get(lines);
    if (!known || bitrate > known.bitrate) best.set(lines, { index, bitrate });
  });
  if (best.size === 0) return [];
  const renditions = [...best.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([lines, { index }]): QualityOption => ({ id: String(lines), label: `${lines}p`, height: lines, badge: qualityBadge(lines), level: index }));
  return [AUTO_OPTION, ...renditions];
}

/** Switch now (not at the next segment boundary): the picture changes within a moment. Auto hands the choice back to hls.js. */
export function applyQuality(hls: HlsLike, option: QualityOption): void {
  hls.currentLevel = option.level;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readStoredQuality(storage: StorageLike | null | undefined): string {
  try {
    const v = storage?.getItem(QUALITY_STORAGE_KEY);
    return v && (v === AUTO || /^\d{3,4}$/.test(v)) ? v : AUTO;
  } catch {
    return AUTO;
  }
}

export function storeQuality(storage: StorageLike | null | undefined, id: string): void {
  try {
    storage?.setItem(QUALITY_STORAGE_KEY, id);
  } catch {
    /* private window or blocked storage: the choice just lasts for this page */
  }
}

/** The option a remembered choice stands for on THIS clip: the same height, else the best below it, else the lowest. */
export function choiceFromStorage(options: QualityOption[], id: string): QualityOption | undefined {
  if (id === AUTO) return options.find((o) => o.id === AUTO);
  const wanted = Number(id);
  const renditions = options.filter((o) => o.height !== null);
  return renditions.find((o) => o.height === wanted) ?? renditions.find((o) => (o.height as number) < wanted) ?? renditions[renditions.length - 1];
}

/** The menu's arrows, Home and End (wrapping); null for any other key. */
export function menuKeyStep(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  if (key === "ArrowDown") return (index + 1) % count;
  if (key === "ArrowUp") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

export interface NativeVariant {
  height: number;
  url: string;
}

/**
 * The variants of a master playlist (best first), their addresses resolved against the master's. Bunny's signed token
 * is a path prefix, so a rendition under the same directory is allowed by the same signature.
 */
export function parseMasterPlaylist(text: string, baseUrl: string): NativeVariant[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const found: NativeVariant[] = [];
  lines.forEach((line, i) => {
    if (!line.startsWith("#EXT-X-STREAM-INF:")) return;
    const res = line.match(/RESOLUTION=(\d+)x(\d+)/i);
    const uri = lines.slice(i + 1).find((l) => l && !l.startsWith("#"));
    if (!res || !uri) return;
    found.push({ height: Math.min(Number(res[1]), Number(res[2])), url: new URL(uri, baseUrl).toString() });
  });
  return found.sort((a, b) => b.height - a.height);
}

/** The menu of a native-HLS player: Auto (the master) then each variant. */
export function nativeOptions(variants: NativeVariant[]): QualityOption[] {
  if (variants.length === 0) return [];
  return [AUTO_OPTION, ...variants.map((v, level): QualityOption => ({ id: String(v.height), label: `${v.height}p`, height: v.height, badge: qualityBadge(v.height), level }))];
}
