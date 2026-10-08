"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Crop, Loader2, Music2, Pause, Play, RotateCcw, Save, Scissors, SlidersHorizontal, Sparkles, Trash2, Volume2, VolumeX, Wand2 } from "lucide-react";
import {
  DEFAULT_EDIT,
  EDITOR_MAX_BYTES,
  SPEEDS,
  VIDEO_FILTERS,
  type VideoEdit,
  type VideoFilter,
  type VideoFormat,
  exportEditedVideo,
  previewFilter,
} from "@/lib/video-edit";
import { type DraftKind, saveDraft } from "@/lib/drafts";

type Details = Record<string, string | number | boolean | string[] | null>;
import { t } from "@/lib/i18n";

type Tool = "trim" | "filters" | "adjust" | "format" | "sound";
const FRAMES = 10;
const STORY_SECONDS = 60;

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${Math.floor((s % 1) * 10)}`;

/** Frames along the video, for the timeline and the filter swatches (decoded by the browser itself). */
function useFilmstrip(src: string | null, duration: number) {
  const [frames, setFrames] = useState<string[]>([]);
  useEffect(() => {
    if (!src || !duration) return;
    let cancelled = false;
    const probe = document.createElement("video");
    probe.src = src;
    probe.muted = true;
    probe.preload = "auto";
    const canvas = document.createElement("canvas");
    const out: string[] = [];
    const grab = (i: number) => {
      if (cancelled || i >= FRAMES) return;
      probe.onseeked = () => {
        if (cancelled) return;
        canvas.width = 160;
        canvas.height = Math.round((160 * probe.videoHeight) / Math.max(1, probe.videoWidth));
        canvas.getContext("2d")?.drawImage(probe, 0, 0, canvas.width, canvas.height);
        out.push(canvas.toDataURL("image/jpeg", 0.6));
        setFrames([...out]);
        grab(i + 1);
      };
      probe.currentTime = Math.min(duration - 0.05, (duration / FRAMES) * (i + 0.5));
    };
    probe.onloadeddata = () => grab(0);
    return () => {
      cancelled = true;
      probe.removeAttribute("src");
      probe.load();
    };
  }, [src, duration]);
  return frames;
}

/** The size of an element, kept up to date. */
function useSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** An object URL for a file, created and revoked in the same effect (safe under React's double effects). */
function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return setUrl(null);
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

const chip = (active: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
    active
      ? "border-violet-500 bg-violet-600/20 text-violet-200 light:text-violet-700"
      : "border-white/10 light:border-black/10 text-zinc-300 light:text-slate-600 hover:border-white/25 light:hover:border-black/25"
  }`;

function Slider({ label, value, min, max, step, display, onChange }: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-[11px] font-semibold text-zinc-400 light:text-slate-500">
        {label}
        <span className="font-mono text-zinc-300 light:text-slate-700">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-violet-500" />
    </label>
  );
}

/**
 * The editor shown before an upload, laid out like the phone apps: Cancel · Save draft · Apply on top, the
 * picture in the middle (drag it to reframe), the open tool below and a tool bar — Trim (filmstrip, two
 * handles, speed), Filters, Adjust, Format and Sound (volume, fades, noise reduction, music). Stories are
 * always vertical 9:16 and at most 60 seconds. "Apply" renders the file in the browser (ffmpeg.wasm).
 * Editing is non-destructive: the caller keeps the original and reopens it with the last settings. "Save
 * draft" keeps the original, the settings and `details` (the form) on the server — see lib/drafts.ts.
 */
export function VideoEditor({
  file,
  kind = "video",
  initialEdit,
  draftId,
  details,
  onApply,
  onClose,
}: {
  file: File;
  /** A story: locked to vertical 9:16 and 60 seconds. */
  kind?: DraftKind;
  /** Settings to start from (a resumed draft). */
  initialEdit?: VideoEdit;
  /** The draft this edit comes from: saving updates it instead of sending the clip again. */
  draftId?: string;
  /** What the caller's form holds, saved with the draft. */
  details?: Details;
  onApply: (edited: File, edit: VideoEdit) => void;
  /** Leaves the editor; with the draft id when the edit was saved as a draft. */
  onClose: (savedDraftId?: string) => void;
}) {
  const story = kind === "story";
  const maxSeconds = story ? STORY_SECONDS : undefined;
  const src = useObjectUrl(file);

  const video = useRef<HTMLVideoElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const stageSize = useSize(stage);

  const [edit, setEdit] = useState<VideoEdit>(() => ({ ...DEFAULT_EDIT, startSeconds: 0, endSeconds: 0, ...initialEdit, ...(story ? { format: "vertical" as const } : {}) }));
  const [baseline, setBaseline] = useState<string>("");
  const set = <K extends keyof VideoEdit>(key: K, value: VideoEdit[K]) => setEdit((e) => ({ ...e, [key]: value }));
  const [duration, setDuration] = useState(0);
  const [natural, setNatural] = useState({ w: 16, h: 9 });
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tool, setTool] = useState<Tool>("trim");
  const [state, setState] = useState<"idle" | "working" | "saving" | "error">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const frames = useFilmstrip(src, duration);
  const musicUrl = useObjectUrl(edit.music);
  const tooLarge = file.size > EDITOR_MAX_BYTES;
  const busy = state === "working" || state === "saving";
  const dirty = baseline !== "" && baseline !== JSON.stringify({ ...edit, music: edit.music?.name ?? null });

  const onLoaded = () => {
    const v = video.current;
    if (!v) return;
    setDuration(v.duration);
    setNatural({ w: v.videoWidth || 16, h: v.videoHeight || 9 });
    setEdit((e) => {
      const start = Math.min(e.startSeconds, v.duration);
      const end = e.endSeconds > start ? Math.min(e.endSeconds, v.duration) : maxSeconds ? Math.min(v.duration, start + maxSeconds) : v.duration;
      const next = { ...e, startSeconds: start, endSeconds: end };
      setBaseline(JSON.stringify({ ...next, music: next.music?.name ?? null }));
      return next;
    });
  };

  // The preview loops on the kept part; the music restarts with it.
  const onTime = () => {
    const v = video.current;
    if (!v) return;
    if (v.currentTime < edit.startSeconds - 0.05 || v.currentTime >= edit.endSeconds) {
      v.currentTime = edit.startSeconds;
      if (music.current) music.current.currentTime = 0;
    }
    setTime(v.currentTime);
  };

  const togglePlay = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }, []);

  // Speed, volume (above 100 % through Web Audio) and the music follow the settings.
  const audio = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.playbackRate = edit.speed;
    if (edit.volume > 1 && !audio.current) {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      ctx.createMediaElementSource(v).connect(gain).connect(ctx.destination);
      audio.current = { ctx, gain };
    }
    if (audio.current) {
      audio.current.gain.gain.value = edit.volume;
      v.volume = 1;
    } else v.volume = edit.volume;
    v.muted = edit.volume === 0;
  }, [edit.speed, edit.volume]);
  useEffect(() => () => void audio.current?.ctx.close(), []);
  useEffect(() => {
    if (music.current) music.current.volume = edit.musicVolume;
  }, [edit.musicVolume, musicUrl]);
  useEffect(() => {
    const m = music.current;
    if (!m) return;
    if (playing) void m.play().catch(() => undefined);
    else m.pause();
  }, [playing, musicUrl]);

  // ── Trim: two handles on the filmstrip; a tap seeks ─────────────────────────────────────────
  const drag = useRef<"start" | "end" | null>(null);
  const timeAt = (clientX: number) => {
    const box = strip.current?.getBoundingClientRect();
    if (!box || !duration) return 0;
    return Math.max(0, Math.min(duration, ((clientX - box.left) / box.width) * duration));
  };
  const setStart = (value: number) =>
    setEdit((e) => {
      const start = Math.max(0, Math.min(value, e.endSeconds - 0.5));
      const end = maxSeconds && e.endSeconds - start > maxSeconds ? start + maxSeconds : e.endSeconds;
      if (video.current) video.current.currentTime = start;
      return { ...e, startSeconds: start, endSeconds: end };
    });
  const setEnd = (value: number) =>
    setEdit((e) => {
      let end = Math.max(value, e.startSeconds + 0.5);
      if (maxSeconds) end = Math.min(end, e.startSeconds + maxSeconds);
      end = Math.min(duration, end);
      if (video.current) video.current.currentTime = Math.max(e.startSeconds, end - 1);
      return { ...e, endSeconds: end };
    });
  const onStripMove = (clientX: number) => {
    if (drag.current === "start") setStart(timeAt(clientX));
    else if (drag.current === "end") setEnd(timeAt(clientX));
  };

  // ── Reframing: the frame keeps its shape, the picture is dragged inside it ──────────────────
  const frameAspect = edit.format === "vertical" ? 9 / 16 : edit.format === "square" ? 1 : natural.w / natural.h;
  const videoAspect = natural.w / natural.h;
  const frame = (() => {
    const w = Math.min(stageSize.w, stageSize.h * frameAspect);
    return { w, h: w / frameAspect };
  })();
  const canPanX = edit.format !== "original" && videoAspect > frameAspect + 0.01;
  const canPanY = edit.format !== "original" && videoAspect < frameAspect - 0.01;
  const pan = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const onPanMove = (e: React.PointerEvent) => {
    if (!pan.current) return;
    // How much of the picture is hidden, in pixels: dragging by that much goes from one edge to the other.
    const hiddenX = frame.h * videoAspect - frame.w;
    const hiddenY = frame.w / videoAspect - frame.h;
    setEdit((s) => ({
      ...s,
      focusX: canPanX && hiddenX > 0 ? Math.max(0, Math.min(1, pan.current!.fx - (e.clientX - pan.current!.x) / hiddenX)) : 0.5,
      focusY: canPanY && hiddenY > 0 ? Math.max(0, Math.min(1, pan.current!.fy - (e.clientY - pan.current!.y) / hiddenY)) : 0.5,
    }));
  };

  // ── Leave, keep as a draft, apply ───────────────────────────────────────────────────────────
  const keepDraft = async () => {
    setState("saving");
    setProgress(0);
    video.current?.pause();
    try {
      const id = await saveDraft({ kind, file, edit, details, draftId, musicChanged: edit.music !== (initialEdit?.music ?? null) }, setProgress);
      onClose(id);
    } catch (error) {
      console.error("video editor: draft not saved", error);
      setNotice(t("editor.draftFailed"));
      setState("idle");
      setLeaving(false);
    }
  };
  const cancel = () => (dirty ? setLeaving(true) : onClose());

  const apply = async () => {
    setState("working");
    setProgress(0);
    video.current?.pause();
    try {
      onApply(await exportEditedVideo(file, edit, setProgress), edit);
    } catch (error) {
      console.error("video editor: export failed", error);
      setState("error");
    }
  };

  // Space plays / pauses, Escape leaves (outside form fields).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || (e.target as HTMLElement).closest("input, textarea, select, button")) return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pct = (s: number) => (duration ? (s / duration) * 100 : 0);
  const kept = (edit.endSeconds - edit.startSeconds) / edit.speed;
  const middleFrame = frames[Math.min(frames.length - 1, Math.floor(FRAMES / 2))];

  const toolButton = (id: Tool, icon: React.ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => setTool(id)}
      aria-pressed={tool === id}
      className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors ${
        tool === id ? "bg-violet-600/15 text-violet-300 light:text-violet-700" : "text-zinc-400 light:text-slate-500 hover:text-white light:hover:text-slate-900"
      }`}
    >
      {icon}
      {t(`editor.tools.${id}`)}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/90 backdrop-blur-md sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <div
        className={`relative flex h-[100dvh] w-full flex-col overflow-hidden bg-zinc-950 text-white light:bg-white light:text-slate-900 sm:h-[min(92vh,860px)] sm:rounded-3xl sm:border sm:border-white/10 sm:light:border-black/10 ${
          story ? "sm:max-w-md" : "sm:max-w-3xl"
        }`}
      >
        {/* Cancel · title · Save draft · Apply */}
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] light:border-black/5">
          <button onClick={cancel} disabled={busy} className="rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-300 hover:text-white disabled:opacity-40 light:text-slate-600 light:hover:text-slate-900">
            {t("editor.cancel")}
          </button>
          <h2 id="editor-title" className="flex-1 truncate text-center text-sm font-bold">
            {t(story ? "editor.titleStory" : "editor.title")}
          </h2>
          <button
            onClick={keepDraft}
            disabled={busy || tooLarge || duration === 0}
            aria-label={t("editor.saveDraft")}
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-40 light:border-black/15 light:text-slate-700 light:hover:bg-black/5 min-[400px]:px-3"
          >
            {state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="hidden min-[400px]:inline">{t("editor.saveDraft")}</span>
          </button>
          <button
            onClick={apply}
            disabled={busy || duration === 0 || tooLarge}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-4 py-1.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {state === "working" && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t("editor.apply")}
          </button>
        </div>

        {tooLarge ? (
          <p className="p-6 text-sm text-zinc-400 light:text-slate-600">{t("editor.tooLarge")}</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
            {/* The picture: the crop frame, play / pause, export progress */}
            <div className="relative flex min-h-0 flex-1 flex-col bg-black">
              <div ref={stage} className="relative m-3 flex min-h-0 flex-1 items-center justify-center">
                <div
                  className={`relative overflow-hidden rounded-2xl bg-zinc-900 ${canPanX || canPanY ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
                  style={{ width: frame.w || "100%", height: frame.h || "100%" }}
                  onClick={() => !(canPanX || canPanY) && togglePlay()}
                  onPointerDown={(e) => {
                    if (!(canPanX || canPanY) || busy) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    pan.current = { x: e.clientX, y: e.clientY, fx: edit.focusX, fy: edit.focusY };
                  }}
                  onPointerMove={onPanMove}
                  onPointerUp={(e) => {
                    const moved = pan.current && Math.hypot(e.clientX - pan.current.x, e.clientY - pan.current.y) > 4;
                    pan.current = null;
                    if (!moved && (canPanX || canPanY)) togglePlay();
                  }}
                >
                  <video
                    ref={video}
                    src={src ?? undefined}
                    onLoadedMetadata={onLoaded}
                    onTimeUpdate={onTime}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    autoPlay
                    playsInline
                    className="pointer-events-none h-full w-full"
                    style={{
                      objectFit: edit.format === "original" ? "contain" : "cover",
                      objectPosition: `${edit.focusX * 100}% ${edit.focusY * 100}%`,
                      filter: previewFilter(edit),
                    }}
                  />
                  {edit.format !== "original" && <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset ring-white/30" />}
                  {(canPanX || canPanY) && !busy && (
                    <span className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-max max-w-[90%] rounded-full bg-black/60 px-3 py-1 text-center text-[11px] text-white">
                      {t("editor.reposition")}
                    </span>
                  )}
                  {!playing && !busy && duration > 0 && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur">
                        <Play className="ml-0.5 h-6 w-6" />
                      </span>
                    </span>
                  )}
                  {busy && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 text-white">
                      <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
                      <span className="text-sm font-semibold">
                        {state === "saving" ? t("editor.savingDraft", { progress }) : progress > 0 ? t("editor.exporting", { progress }) : t("editor.loading")}
                      </span>
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/20">
                        <div className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 pb-2 text-[11px] text-zinc-400">
                <button type="button" onClick={togglePlay} disabled={busy} className="flex items-center gap-1.5 font-semibold text-zinc-200 disabled:opacity-40" aria-label={playing ? t("editor.pause") : t("editor.play")}>
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  <span className="whitespace-nowrap font-mono">{clock(Math.max(0, time - edit.startSeconds) / edit.speed)} / {clock(kept)}</span>
                </button>
                <span className="hidden text-right sm:block">{t("editor.previewNote")}</span>
              </div>
              {musicUrl && <audio ref={music} src={musicUrl} loop preload="auto" />}
            </div>

            {/* The open tool, then the tool bar */}
            <div className="flex shrink-0 flex-col border-t border-white/10 light:border-black/5 sm:w-80 sm:border-l sm:border-t-0">
              <div className="max-h-[38dvh] min-h-[132px] space-y-3 overflow-y-auto px-4 py-4 sm:max-h-none sm:flex-1">
                {tool === "trim" && (
                  <>
                    <div className="flex justify-between text-[11px] text-zinc-400 light:text-slate-500">
                      <span className="font-mono">{t("editor.selection", { start: clock(edit.startSeconds), end: clock(edit.endSeconds), length: kept.toFixed(1) })}</span>
                      {maxSeconds && <span>{t("editor.maxLength", { seconds: maxSeconds })}</span>}
                    </div>
                    <div
                      ref={strip}
                      className="relative h-14 touch-none select-none overflow-hidden rounded-xl bg-zinc-900 light:bg-slate-200"
                      onPointerDown={(e) => {
                        if (drag.current || !video.current) return;
                        video.current.currentTime = Math.max(edit.startSeconds, Math.min(edit.endSeconds - 0.05, timeAt(e.clientX)));
                      }}
                      onPointerMove={(e) => drag.current && onStripMove(e.clientX)}
                      onPointerUp={() => (drag.current = null)}
                      onPointerCancel={() => (drag.current = null)}
                    >
                      <div className="pointer-events-none absolute inset-0 flex">
                        {Array.from({ length: FRAMES }, (_, i) =>
                          frames[i] ? <img key={i} src={frames[i]} alt="" className="h-full min-w-0 flex-1 object-cover" /> : <div key={i} className="flex-1 animate-pulse border-r border-black/20 bg-white/5" />,
                        )}
                      </div>
                      <div className="pointer-events-none absolute inset-y-0 left-0 bg-black/70" style={{ width: `${pct(edit.startSeconds)}%` }} />
                      <div className="pointer-events-none absolute inset-y-0 right-0 bg-black/70" style={{ width: `${100 - pct(edit.endSeconds)}%` }} />
                      <div className="pointer-events-none absolute inset-y-0 border-y-[3px] border-violet-500" style={{ left: `${pct(edit.startSeconds)}%`, right: `${100 - pct(edit.endSeconds)}%` }} />
                      <div className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.8)]" style={{ left: `${pct(time)}%` }} />
                      {(["start", "end"] as const).map((handle) => (
                        <button
                          key={handle}
                          type="button"
                          aria-label={t(handle === "start" ? "editor.start" : "editor.end")}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            strip.current?.setPointerCapture(e.pointerId);
                            drag.current = handle;
                          }}
                          onKeyDown={(e) => {
                            const step = e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0;
                            if (!step) return;
                            e.preventDefault();
                            if (handle === "start") setStart(edit.startSeconds + step);
                            else setEnd(edit.endSeconds + step);
                          }}
                          className={`absolute inset-y-0 z-10 flex w-4 cursor-ew-resize items-center justify-center bg-violet-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                            handle === "start" ? "rounded-l-lg" : "-translate-x-full rounded-r-lg"
                          }`}
                          style={{ left: `${pct(handle === "start" ? edit.startSeconds : edit.endSeconds)}%` }}
                        >
                          <span className="h-5 w-0.5 rounded bg-white" />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-zinc-400 light:text-slate-500">{t("editor.speed")}</span>
                      {SPEEDS.map((s) => (
                        <button key={s} type="button" onClick={() => set("speed", s)} aria-pressed={edit.speed === s} className={chip(edit.speed === s)}>
                          {s}×
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {tool === "filters" && (
                  <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
                    {(Object.keys(VIDEO_FILTERS) as VideoFilter[]).map((name) => (
                      <button key={name} type="button" onClick={() => set("filter", name)} aria-pressed={edit.filter === name} className="flex shrink-0 flex-col items-center gap-1.5">
                        <span className={`block h-16 w-16 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-zinc-950 light:ring-offset-white ${edit.filter === name ? "ring-violet-500" : "ring-transparent"}`}>
                          {middleFrame ? (
                            <img src={middleFrame} alt="" className="h-full w-full object-cover" style={{ filter: VIDEO_FILTERS[name].css || undefined }} />
                          ) : (
                            <span className="block h-full w-full animate-pulse bg-white/10" />
                          )}
                        </span>
                        <span className={`text-[11px] font-semibold ${edit.filter === name ? "text-violet-300 light:text-violet-700" : "text-zinc-400 light:text-slate-500"}`}>
                          {t(`editor.filterNames.${name}`)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {tool === "adjust" && (
                  <>
                    {(["brightness", "contrast", "saturation"] as const).map((key) => (
                      <Slider
                        key={key}
                        label={t(`editor.adjust.${key}`)}
                        value={edit[key]}
                        min={-0.5}
                        max={0.5}
                        step={0.01}
                        display={`${edit[key] > 0 ? "+" : ""}${Math.round(edit[key] * 100)}`}
                        onChange={(v) => set(key, v)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => setEdit((e) => ({ ...e, brightness: 0, contrast: 0, saturation: 0 }))}
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white light:text-slate-500 light:hover:text-slate-900"
                    >
                      <RotateCcw className="h-3 w-3" /> {t("editor.adjust.reset")}
                    </button>
                  </>
                )}

                {tool === "format" && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {(["original", "vertical", "square"] as VideoFormat[]).map((f) => {
                        const locked = story && f !== "vertical";
                        return (
                          <button
                            key={f}
                            type="button"
                            disabled={locked}
                            onClick={() => setEdit((e) => ({ ...e, format: f, focusX: 0.5, focusY: 0.5 }))}
                            aria-pressed={edit.format === f}
                            className={`flex flex-col items-center gap-2 rounded-xl border py-3 text-xs font-semibold disabled:opacity-30 ${
                              edit.format === f ? "border-violet-500 bg-violet-600/15 text-violet-200 light:text-violet-700" : "border-white/10 text-zinc-300 light:border-black/10 light:text-slate-600"
                            }`}
                          >
                            <span className={`block rounded-sm border-2 border-current ${f === "vertical" ? "h-7 w-4" : f === "square" ? "h-6 w-6" : "h-5 w-8"}`} />
                            {t(`editor.formats.${f}`)}
                          </button>
                        );
                      })}
                    </div>
                    {story && <p className="text-xs text-zinc-400 light:text-slate-600">{t("editor.storyVertical")}</p>}
                  </>
                )}

                {tool === "sound" && (
                  <>
                    <div className="flex items-end gap-3">
                      <button
                        type="button"
                        onClick={() => set("volume", edit.volume === 0 ? 1 : 0)}
                        aria-pressed={edit.volume === 0}
                        aria-label={edit.volume === 0 ? t("editor.sound.volume") : t("editor.sound.muted")}
                        className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 light:border-black/10"
                      >
                        {edit.volume === 0 ? <VolumeX className="h-4 w-4 text-rose-300" /> : <Volume2 className="h-4 w-4" />}
                      </button>
                      <div className="flex-1">
                        <Slider
                          label={t("editor.sound.volume")}
                          value={edit.volume}
                          min={0}
                          max={2}
                          step={0.05}
                          display={edit.volume === 0 ? t("editor.sound.muted") : `${Math.round(edit.volume * 100)} %`}
                          onChange={(v) => set("volume", v)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["fadeIn", "fadeOut", "denoise"] as const).map((key) => (
                        <button key={key} type="button" onClick={() => set(key, !edit[key])} aria-pressed={edit[key]} className={chip(edit[key])}>
                          {key === "denoise" && <Wand2 className="mr-1 inline h-3 w-3" />}
                          {t(`editor.sound.${key}`)}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-xl border border-white/10 p-3 light:border-black/10">
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 light:text-slate-500">
                        <Music2 className="h-3.5 w-3.5" /> {t("editor.sound.music")}
                      </p>
                      {edit.music ? (
                        <>
                          <div className="mb-2 flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-xs font-semibold">{edit.music.name}</span>
                            <button type="button" onClick={() => set("music", null)} className="rounded-lg p-1 text-zinc-400 hover:text-rose-300" aria-label={t("editor.sound.removeMusic")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <Slider
                            label={t("editor.sound.musicVolume")}
                            value={edit.musicVolume}
                            min={0}
                            max={1}
                            step={0.05}
                            display={`${Math.round(edit.musicVolume * 100)} %`}
                            onChange={(v) => set("musicVolume", v)}
                          />
                        </>
                      ) : (
                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 py-2.5 text-xs font-semibold text-violet-300 hover:border-violet-500/60 light:border-black/15 light:text-violet-700">
                          <Music2 className="h-3.5 w-3.5" /> {t("editor.sound.addMusic")}
                          <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && set("music", e.target.files[0])} />
                        </label>
                      )}
                      <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">{t("editor.sound.musicHint")}</p>
                    </div>
                  </>
                )}

                {state === "error" && <p role="alert" className="text-xs text-rose-400">{t("editor.failed")}</p>}
                {notice && <p role="status" className="text-xs text-amber-300 light:text-amber-700">{notice}</p>}
              </div>

              <div className="flex gap-1 border-t border-white/10 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] light:border-black/5">
                {toolButton("trim", <Scissors className="h-5 w-5" />)}
                {toolButton("filters", <Sparkles className="h-5 w-5" />)}
                {toolButton("adjust", <SlidersHorizontal className="h-5 w-5" />)}
                {toolButton("format", <Crop className="h-5 w-5" />)}
                {toolButton("sound", edit.volume === 0 && !edit.music ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />)}
              </div>
            </div>
          </div>
        )}

        {/* Leaving with changes: keep them as a draft, drop them, or stay */}
        {leaving && (
          <div className="absolute inset-0 z-20 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="alertdialog" aria-labelledby="leave-title">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-5 light:border-black/10 light:bg-white">
              <h3 id="leave-title" className="text-sm font-bold">{t("editor.discard.title")}</h3>
              <p className="mt-1 text-xs text-zinc-400 light:text-slate-600">{t("editor.discard.body")}</p>
              <div className="mt-4 space-y-2">
                <button onClick={keepDraft} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t("editor.saveDraft")}
                </button>
                <button onClick={() => onClose()} disabled={busy} className="w-full rounded-xl border border-rose-500/30 py-2.5 text-sm font-semibold text-rose-300 light:text-rose-600">
                  {t("editor.discard.discard")}
                </button>
                <button onClick={() => setLeaving(false)} disabled={busy} className="w-full rounded-xl py-2.5 text-sm font-semibold text-zinc-300 light:text-slate-600">
                  {t("editor.discard.keep")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
