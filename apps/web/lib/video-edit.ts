"use client";

/**
 * In-browser video editing with ffmpeg.wasm — trim, speed, filters, light/contrast/colour, crop to 9:16 or
 * square, and sound (volume, fades, noise reduction, a music track mixed in) — applied before the upload:
 * the file never leaves the device until it is sent to Bunny. The engine (~30 MB, single-threaded core, no
 * special headers needed) is fetched once, the first time the editor exports.
 */

import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { UPLOAD_LIMITS } from "@orochia/media/limits";
import { VIDEO_FILTERS, type VideoEdit, type VideoFormat } from "./video-edit-settings";

export * from "./video-edit-settings";

/** Served from this origin (public/ffmpeg, copied by scripts/copy-ffmpeg.mjs): its worker must be same-origin. */
const FFMPEG_MODULE = "/ffmpeg/index.js";

const CORE_VERSION = "0.12.10";
// ESM build: the worker is an ES module and imports the core.
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

const CROP: Record<Exclude<VideoFormat, "original">, string> = {
  vertical: "'min(iw,ih*9/16)':'min(ih,iw*16/9)'",
  square: "'min(iw,ih)':'min(iw,ih)'",
};
/** Output caps: 1080 on the short side keeps phones' 4K files small without visible loss. */
const SCALE = "scale='if(gt(iw,ih),-2,min(1080,trunc(iw/2)*2))':'if(gt(iw,ih),min(1080,trunc(ih/2)*2),-2)'";

/** Above this the browser runs out of memory or patience: such files are uploaded as they are. */
export const EDITOR_MAX_BYTES = UPLOAD_LIMITS.draft.maxBytes;

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

/** Whether the file has a sound track (ffmpeg lists the streams when asked for no output). */
async function hasAudio(ffmpeg: FFmpeg, input: string): Promise<boolean> {
  let found = false;
  const listen = ({ message }: { message: string }) => {
    if (/Stream #\d+:\d+.*Audio:/.test(message)) found = true;
  };
  ffmpeg.on("log", listen);
  try {
    await ffmpeg.exec(["-hide_banner", "-i", input]);
  } finally {
    ffmpeg.off("log", listen);
  }
  return found;
}

/** The ffmpeg arguments for an edit (exported for tests). */
export function buildArgs(edit: VideoEdit, input: string, music: string | null, sourceHasAudio: boolean): string[] {
  const length = Math.max(0.1, edit.endSeconds - edit.startSeconds) / edit.speed;
  const adjust =
    edit.brightness || edit.contrast || edit.saturation
      ? `eq=brightness=${(edit.brightness * 0.25).toFixed(3)}:contrast=${(1 + edit.contrast).toFixed(3)}:saturation=${(1 + edit.saturation).toFixed(3)}`
      : "";
  const video = [
    edit.format === "original" ? "" : `crop=${CROP[edit.format]}:'(in_w-out_w)*${edit.focusX.toFixed(3)}':'(in_h-out_h)*${edit.focusY.toFixed(3)}'`,
    VIDEO_FILTERS[edit.filter].ffmpeg,
    adjust,
    edit.speed === 1 ? "" : `setpts=PTS/${edit.speed}`,
    SCALE,
  ].filter(Boolean);

  const fades = (chain: string[]) => {
    if (edit.fadeIn) chain.push(`afade=t=in:d=${Math.min(1, length / 3).toFixed(2)}`);
    if (edit.fadeOut) chain.push(`afade=t=out:st=${Math.max(0, length - Math.min(1, length / 3)).toFixed(2)}:d=${Math.min(1, length / 3).toFixed(2)}`);
    return chain;
  };
  const graph = [`[0:v]${video.join(",")}[v]`];
  const original = sourceHasAudio && edit.volume > 0;
  if (original) {
    const chain = [`volume=${edit.volume.toFixed(2)}`];
    if (edit.denoise) chain.push("afftdn=nf=-25");
    if (edit.speed !== 1) chain.push(`atempo=${edit.speed}`);
    graph.push(`[0:a]${(music ? chain : fades(chain)).join(",")}[a0]`);
  }
  if (music) graph.push(`[1:a]atrim=0:${length.toFixed(2)},asetpts=PTS-STARTPTS,volume=${edit.musicVolume.toFixed(2)}[m]`);
  if (original && music) graph.push(`[a0][m]amix=inputs=2:duration=first:normalize=0,${fades([]).join(",") || "anull"}[a]`);
  else if (music) graph.push(`[m]${fades([]).join(",") || "anull"}[a]`);
  const audioOut = original && !music ? "[a0]" : music ? "[a]" : null;

  return [
    "-ss", edit.startSeconds.toFixed(2),
    "-i", input,
    ...(music ? ["-stream_loop", "-1", "-i", music] : []),
    "-filter_complex", graph.join(";"),
    "-map", "[v]",
    ...(audioOut ? ["-map", audioOut, "-c:a", "aac", "-b:a", "128k"] : ["-an"]),
    "-t", length.toFixed(2),
    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "output.mp4",
  ];
}

/** Applies the edit and returns a new MP4 (H.264/AAC, fast start), reporting progress 0–100. */
export async function exportEditedVideo(file: File, edit: VideoEdit, onProgress?: (percent: number) => void): Promise<File> {
  const ffmpeg = await loadEngine();
  const { fetchFile } = await import("@ffmpeg/util");
  const input = `input${file.name.match(/\.\w+$/)?.[0] ?? ".mp4"}`;
  const music = edit.music ? `music${edit.music.name.match(/\.\w+$/)?.[0] ?? ".mp3"}` : null;
  const progress = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(100, Math.round(progress * 100))));
  try {
    await ffmpeg.writeFile(input, await fetchFile(file));
    if (music && edit.music) await ffmpeg.writeFile(music, await fetchFile(edit.music));
    const audio = await hasAudio(ffmpeg, input);
    ffmpeg.on("progress", progress);
    if ((await ffmpeg.exec(buildArgs(edit, input, music, audio))) !== 0) throw new Error("The video could not be processed.");
    const data = await ffmpeg.readFile("output.mp4");
    const name = file.name.replace(/\.\w+$/, "") + "-edited.mp4";
    return new File([new Uint8Array(data as Uint8Array)], name, { type: "video/mp4" });
  } finally {
    ffmpeg.off("progress", progress);
    for (const f of [input, music, "output.mp4"]) if (f) await ffmpeg.deleteFile(f).catch(() => undefined);
  }
}
