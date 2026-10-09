"use client";

import React, { useRef } from "react";
import { FILMSTRIP_FRAMES, clock } from "./media";
import { t } from "@/lib/i18n";

type Grip = "start" | "end" | "playhead";

/**
 * The trim timeline: the clip as a filmstrip, the kept part framed between two handles (dragged, or moved with the
 * arrow keys — Shift for whole seconds), the playhead you can scrub, and the times of the selection.
 */
export function Timeline({
  frames,
  duration,
  start,
  end,
  time,
  onStart,
  onEnd,
  onSeek,
}: {
  frames: string[];
  duration: number;
  start: number;
  end: number;
  time: number;
  onStart: (s: number) => void;
  onEnd: (s: number) => void;
  onSeek: (s: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const grip = useRef<Grip | null>(null);
  const pct = (s: number) => (duration ? (s / duration) * 100 : 0);
  const at = (clientX: number) => {
    const box = strip.current?.getBoundingClientRect();
    if (!box || !duration) return 0;
    return Math.max(0, Math.min(duration, ((clientX - box.left) / box.width) * duration));
  };
  const drag = (clientX: number) => {
    const s = at(clientX);
    if (grip.current === "start") onStart(s);
    else if (grip.current === "end") onEnd(s);
    else if (grip.current === "playhead") onSeek(Math.max(start, Math.min(end - 0.05, s)));
  };
  const begin = (which: Grip, e: React.PointerEvent) => {
    e.stopPropagation();
    strip.current?.setPointerCapture(e.pointerId);
    grip.current = which;
    if (which === "playhead") drag(e.clientX);
  };
  const nudge = (which: "start" | "end", e: React.KeyboardEvent) => {
    const step = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0);
    if (!step) return;
    e.preventDefault();
    if (which === "start") onStart(start + step);
    else onEnd(end + step);
  };

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between font-mono text-[11px] tabular-nums text-zinc-400">
        <span>{clock(start)}</span>
        <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-sans text-xs font-semibold text-accent">{t("editor.kept", { length: (end - start).toFixed(1) })}</span>
        <span>{clock(end)}</span>
      </div>
      <div
        ref={strip}
        className="relative h-16 touch-none rounded-xl bg-zinc-900"
        onPointerDown={(e) => begin("playhead", e)}
        onPointerMove={(e) => grip.current && drag(e.clientX)}
        onPointerUp={() => (grip.current = null)}
        onPointerCancel={() => (grip.current = null)}
      >
        <div className="pointer-events-none absolute inset-0 flex overflow-hidden rounded-xl">
          {Array.from({ length: FILMSTRIP_FRAMES }, (_, i) =>
            frames[i] ? <img key={i} src={frames[i]} alt="" className="h-full min-w-0 flex-1 object-cover" /> : <div key={i} className="flex-1 animate-pulse border-r border-black/30 bg-white/6" />,
          )}
        </div>
        {/* Outside the kept part is dimmed */}
        <div className="pointer-events-none absolute inset-y-0 left-0 rounded-l-xl bg-scrim-strong" style={{ width: `${pct(start)}%` }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 rounded-r-xl bg-scrim-strong" style={{ width: `${100 - pct(end)}%` }} />
        <div className="pointer-events-none absolute inset-y-0 border-y-[3px] border-white" style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }} />

        {/* Playhead */}
        <div className="pointer-events-none absolute -inset-y-1.5 w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(0,0,0,0.9)]" style={{ left: `${pct(time)}%` }} />

        {(["start", "end"] as const).map((which) => (
          <div
            key={which}
            role="slider"
            tabIndex={0}
            aria-label={t(which === "start" ? "editor.start" : "editor.end")}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration * 10) / 10}
            aria-valuenow={Math.round((which === "start" ? start : end) * 10) / 10}
            aria-valuetext={clock(which === "start" ? start : end)}
            onPointerDown={(e) => begin(which, e)}
            onKeyDown={(e) => nudge(which, e)}
            className={`absolute inset-y-0 z-10 flex w-6 cursor-ew-resize items-center justify-center bg-white text-zinc-900 shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
              which === "start" ? "rounded-l-xl" : "-translate-x-full rounded-r-xl"
            }`}
            style={{ left: `${pct(which === "start" ? start : end)}%` }}
          >
            <span className="flex gap-[3px]">
              <span className="h-5 w-[2px] rounded-sm bg-zinc-400" />
              <span className="h-5 w-[2px] rounded-sm bg-zinc-400" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
