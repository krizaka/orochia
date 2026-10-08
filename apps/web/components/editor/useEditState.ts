"use client";

import { useCallback, useMemo, useState } from "react";
import { DEFAULT_EDIT, type VideoEdit } from "@/lib/video-edit";

export type Tool = "trim" | "filters" | "adjust" | "format" | "sound";
export const TOOLS: Tool[] = ["trim", "filters", "adjust", "format", "sound"];

/** Shortest piece that can be kept, in seconds. */
const MIN_KEEP = 0.5;

const fingerprint = (e: VideoEdit) => JSON.stringify({ ...e, music: e.music ? `${e.music.name}:${e.music.size}` : null });

/** What each tool resets to (trim resets to the whole clip, within the length limit). */
function resetFor(tool: Tool, duration: number, maxSeconds?: number): Partial<VideoEdit> {
  switch (tool) {
    case "trim":
      return { startSeconds: 0, endSeconds: maxSeconds ? Math.min(duration, maxSeconds) : duration, speed: 1 };
    case "filters":
      return { filter: "none" };
    case "adjust":
      return { brightness: 0, contrast: 0, saturation: 0 };
    case "format":
      return { focusX: 0.5, focusY: 0.5 };
    case "sound":
      return { volume: 1, fadeIn: false, fadeOut: false, denoise: false, music: null, musicVolume: DEFAULT_EDIT.musicVolume };
  }
}

/**
 * The edit being made: its settings, clamped setters for the trim (a story keeps at most `maxSeconds`), whether
 * anything changed since the clip opened, and per-tool resets. Pure state — the preview follows it.
 */
export function useEditState({ initial, lockedFormat, maxSeconds }: { initial?: VideoEdit; lockedFormat?: VideoEdit["format"]; maxSeconds?: number }) {
  const [edit, setEdit] = useState<VideoEdit>(() => ({ ...DEFAULT_EDIT, startSeconds: 0, endSeconds: 0, ...initial, ...(lockedFormat ? { format: lockedFormat } : {}) }));
  const [duration, setDuration] = useState(0);
  const [baseline, setBaseline] = useState<string | null>(null);

  const set = useCallback(<K extends keyof VideoEdit>(key: K, value: VideoEdit[K]) => setEdit((e) => ({ ...e, [key]: value })), []);
  const patch = useCallback((p: Partial<VideoEdit>) => setEdit((e) => ({ ...e, ...p })), []);

  /** Once the clip's length is known: the trim fits it, and this becomes the "unchanged" state. */
  const loaded = useCallback(
    (length: number) => {
      setDuration(length);
      setEdit((e) => {
        const start = Math.min(e.startSeconds, length);
        const end = e.endSeconds > start ? Math.min(e.endSeconds, length) : maxSeconds ? Math.min(length, start + maxSeconds) : length;
        const next = { ...e, startSeconds: start, endSeconds: end };
        setBaseline(fingerprint(next));
        return next;
      });
    },
    [maxSeconds],
  );

  const setStart = useCallback(
    (value: number) =>
      setEdit((e) => {
        const start = Math.max(0, Math.min(value, e.endSeconds - MIN_KEEP));
        const end = maxSeconds && e.endSeconds - start > maxSeconds ? start + maxSeconds : e.endSeconds;
        return { ...e, startSeconds: start, endSeconds: end };
      }),
    [maxSeconds],
  );

  const setEnd = useCallback(
    (value: number) =>
      setEdit((e) => {
        let end = Math.max(value, e.startSeconds + MIN_KEEP);
        if (maxSeconds) end = Math.min(end, e.startSeconds + maxSeconds);
        return { ...e, endSeconds: Math.min(duration || end, end) };
      }),
    [duration, maxSeconds],
  );

  const reset = useCallback((tool: Tool) => patch(resetFor(tool, duration, maxSeconds)), [patch, duration, maxSeconds]);

  const dirty = useMemo(() => baseline !== null && baseline !== fingerprint(edit), [baseline, edit]);
  /** Length of the result, after trim and speed. */
  const keptSeconds = (edit.endSeconds - edit.startSeconds) / edit.speed;

  return { edit, set, patch, duration, loaded, setStart, setEnd, reset, dirty, keptSeconds };
}
