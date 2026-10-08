"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, Scissors, VolumeX, X } from "lucide-react";
import { EDITOR_MAX_BYTES, VIDEO_FILTERS, type VideoFilter, exportEditedVideo } from "@/lib/video-edit";
import { t } from "@/lib/i18n";

/**
 * A light video editor shown before an upload: trim, filter, mute, vertical crop. The preview applies the
 * filter in CSS; "Apply" renders the real file in the browser (ffmpeg.wasm) and hands it back.
 */
export function VideoEditor({
  file,
  maxSeconds,
  defaultVertical = false,
  onApply,
  onClose,
}: {
  file: File;
  /** Longest result allowed (stories); the end handle cannot go past start + maxSeconds. */
  maxSeconds?: number;
  defaultVertical?: boolean;
  onApply: (edited: File) => void;
  onClose: () => void;
}) {
  // Created and revoked in the same effect: safe under React's double-invoked effects in development.
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const video = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [filter, setFilter] = useState<VideoFilter>("none");
  const [mute, setMute] = useState(false);
  const [vertical, setVertical] = useState(defaultVertical);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const tooLarge = file.size > EDITOR_MAX_BYTES;

  const onLoaded = () => {
    const d = video.current?.duration ?? 0;
    setDuration(d);
    setEnd(maxSeconds ? Math.min(d, maxSeconds) : d);
  };

  // The preview loops on the kept part.
  const onTime = () => {
    const v = video.current;
    if (v && (v.currentTime < start || v.currentTime > end)) v.currentTime = start;
  };

  const setStartClamped = (value: number) => {
    const s = Math.min(value, end - 0.5);
    setStart(Math.max(0, s));
    if (maxSeconds && end - s > maxSeconds) setEnd(s + maxSeconds);
    if (video.current) video.current.currentTime = Math.max(0, s);
  };
  const setEndClamped = (value: number) => {
    let e = Math.max(value, start + 0.5);
    if (maxSeconds) e = Math.min(e, start + maxSeconds);
    setEnd(Math.min(duration, e));
  };

  const apply = async () => {
    setState("working");
    setProgress(0);
    try {
      onApply(await exportEditedVideo(file, { startSeconds: start, endSeconds: end, filter, mute, vertical }, setProgress));
    } catch (error) {
      console.error("video editor: export failed", error);
      setState("error");
    }
  };

  const slider = "w-full accent-violet-500";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/85 backdrop-blur-md sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 light:border-black/10 bg-zinc-950 light:bg-white p-5 text-white light:text-slate-900 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="editor-title" className="flex items-center gap-2 text-base font-bold">
            <Scissors className="h-4 w-4 text-violet-400" /> {t("editor.title")}
          </h2>
          <button onClick={onClose} disabled={state === "working"} className="rounded-full p-1.5 text-zinc-400 hover:bg-white/5" aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {tooLarge ? (
          <p className="text-sm text-zinc-400 light:text-slate-600">{t("editor.tooLarge")}</p>
        ) : (
          <>
            <div className={`mx-auto overflow-hidden rounded-2xl bg-black ${vertical ? "aspect-[9/16] max-h-[46vh]" : "aspect-video"}`}>
              <video
                ref={video}
                src={src ?? undefined}
                onLoadedMetadata={onLoaded}
                onTimeUpdate={onTime}
                muted={mute}
                autoPlay
                playsInline
                loop
                className={`h-full w-full ${vertical ? "object-cover" : "object-contain"}`}
                style={{ filter: VIDEO_FILTERS[filter].css || undefined }}
              />
            </div>
            <p className="mt-1.5 text-center text-[10px] text-zinc-500">{t("editor.previewNote")}</p>

            <fieldset className="mt-4 space-y-2" disabled={state === "working"}>
              <legend className="mb-1 flex w-full justify-between text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">
                {t("editor.trim")}
                <span className="font-mono normal-case tracking-normal">{t("editor.length", { seconds: (end - start).toFixed(1) })}</span>
              </legend>
              <label className="block text-[11px] text-zinc-400 light:text-slate-500">
                {t("editor.start")} · {start.toFixed(1)} s
                <input type="range" min={0} max={duration || 0} step={0.1} value={start} onChange={(e) => setStartClamped(Number(e.target.value))} className={slider} />
              </label>
              <label className="block text-[11px] text-zinc-400 light:text-slate-500">
                {t("editor.end")} · {end.toFixed(1)} s
                <input type="range" min={0} max={duration || 0} step={0.1} value={end} onChange={(e) => setEndClamped(Number(e.target.value))} className={slider} />
              </label>
              {maxSeconds && <p className="text-[11px] text-zinc-500">{t("editor.maxLength", { seconds: maxSeconds })}</p>}
            </fieldset>

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">{t("editor.filters")}</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(Object.keys(VIDEO_FILTERS) as VideoFilter[]).map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={state === "working"}
                    onClick={() => setFilter(name)}
                    aria-pressed={filter === name}
                    className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold ${
                      filter === name ? "border-violet-500 bg-violet-600/15 text-violet-200 light:text-violet-700" : "border-white/10 light:border-black/10 text-zinc-300 light:text-slate-600"
                    }`}
                  >
                    {t(`editor.filterNames.${name}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={mute} onChange={(e) => setMute(e.target.checked)} disabled={state === "working"} className="accent-violet-600" />
                <VolumeX className="h-4 w-4 text-zinc-400" /> {t("editor.mute")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={vertical} onChange={(e) => setVertical(e.target.checked)} disabled={state === "working"} className="accent-violet-600" />
                {t("editor.vertical")}
              </label>
            </div>

            {state === "error" && <p role="alert" className="mt-3 text-xs text-rose-400">{t("editor.failed")}</p>}

            <button
              onClick={apply}
              disabled={state === "working" || duration === 0}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 py-3.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {state === "working" && <Loader2 className="h-4 w-4 animate-spin" />}
              {state === "working" ? (progress > 0 ? t("editor.exporting", { progress }) : t("editor.loading")) : t("editor.apply")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
