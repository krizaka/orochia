"use client";

/**
 * In-browser video editing with ffmpeg.wasm: trim, filters, mute and a vertical 9:16 crop, applied
 * before the upload — the file never leaves the device until it is sent to Bunny. The engine (~30 MB,
 * single-threaded core, no special headers needed) is fetched once, the first time the editor exports.
 */

import type { FFmpeg } from "@ffmpeg/ffmpeg";

/** Served from this origin (public/ffmpeg, copied by scripts/copy-ffmpeg.mjs): its worker must be same-origin. */
const FFMPEG_MODULE = "/ffmpeg/index.js";

const CORE_VERSION = "0.12.10";
// ESM build: the worker is an ES module and imports the core.
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

export const VIDEO_FILTERS = {
  none: { ffmpeg: "", css: "" },
  vivid: { ffmpeg: "eq=saturation=1.45:contrast=1.08", css: "saturate(1.45) contrast(1.08)" },
  warm: { ffmpeg: "colorbalance=rs=0.12:gs=0.02:bs=-0.12", css: "sepia(0.25) saturate(1.2)" },
  cool: { ffmpeg: "colorbalance=rs=-0.1:bs=0.14", css: "hue-rotate(12deg) saturate(1.1)" },
  mono: { ffmpeg: "hue=s=0", css: "grayscale(1)" },
  noir: { ffmpeg: "hue=s=0,eq=contrast=1.45:brightness=-0.05", css: "grayscale(1) contrast(1.45) brightness(0.95)" },
  vintage: { ffmpeg: "curves=preset=vintage", css: "sepia(0.45) contrast(0.95) saturate(0.85)" },
} as const;
export type VideoFilter = keyof typeof VIDEO_FILTERS;

export interface VideoEdit {
  startSeconds: number;
  endSeconds: number;
  filter: VideoFilter;
  mute: boolean;
  /** Crop to a vertical 9:16 frame (stories). */
  vertical: boolean;
}

/** Above this the browser runs out of memory or patience: such files are uploaded as they are. */
export const EDITOR_MAX_BYTES = 400 * 1024 * 1024;

let engine: Promise<FFmpeg> | null = null;

async function loadEngine(): Promise<FFmpeg> {
  engine ??= (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
      import(/* webpackIgnore: true */ /* turbopackIgnore: true */ FFMPEG_MODULE) as Promise<typeof import("@ffmpeg/ffmpeg")>,
      import("@ffmpeg/util"),
    ]);
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ffmpeg;
  })().catch((error) => {
    engine = null;
    throw error;
  });
  return engine;
}

/** Applies the edit and returns a new MP4 (H.264/AAC, fast start), reporting progress 0–100. */
export async function exportEditedVideo(file: File, edit: VideoEdit, onProgress?: (percent: number) => void): Promise<File> {
  const ffmpeg = await loadEngine();
  const { fetchFile } = await import("@ffmpeg/util");
  const input = `input${file.name.match(/\.\w+$/)?.[0] ?? ".mp4"}`;
  const progress = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(100, Math.round(progress * 100))));
  ffmpeg.on("progress", progress);
  try {
    await ffmpeg.writeFile(input, await fetchFile(file));
    const filters = [
      edit.vertical ? "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)'" : "",
      VIDEO_FILTERS[edit.filter].ffmpeg,
      "scale='trunc(iw/2)*2':'trunc(ih/2)*2'",
    ].filter(Boolean);
    const args = [
      "-i", input,
      "-ss", edit.startSeconds.toFixed(2),
      "-to", edit.endSeconds.toFixed(2),
      "-vf", filters.join(","),
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p",
      ...(edit.mute ? ["-an"] : ["-c:a", "aac", "-b:a", "128k"]),
      "-movflags", "+faststart",
      "output.mp4",
    ];
    if ((await ffmpeg.exec(args)) !== 0) throw new Error("The video could not be processed.");
    const data = await ffmpeg.readFile("output.mp4");
    const name = file.name.replace(/\.\w+$/, "") + "-edited.mp4";
    return new File([new Uint8Array(data as Uint8Array)], name, { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", progress);
    await ffmpeg.deleteFile(input).catch(() => undefined);
    await ffmpeg.deleteFile("output.mp4").catch(() => undefined);
  }
}
