"use client";

import React, { forwardRef, useRef, useState } from "react";
import { Hand, Play } from "lucide-react";
import { Spinner } from "@/components/ui";
import { previewFilter, type VideoEdit } from "@/lib/video-edit";
import { useElementSize } from "./media";
import { t } from "@/lib/i18n";

export interface StageProgress {
  label: string;
  percent: number;
}

/**
 * The picture: the crop frame keeps the chosen shape and the video is dragged inside it to choose what stays in
 * (a tap plays / pauses). The preview applies the look in CSS; while rendering or saving, progress covers it.
 */
export const Stage = forwardRef<
  HTMLVideoElement,
  {
    src: string | null;
    edit: VideoEdit;
    natural: { w: number; h: number };
    playing: boolean;
    progress: StageProgress | null;
    onTogglePlay: () => void;
    onFocus: (focus: { focusX: number; focusY: number }) => void;
    videoProps: React.VideoHTMLAttributes<HTMLVideoElement>;
  }
>(function Stage({ src, edit, natural, playing, progress, onTogglePlay, onFocus, videoProps }, video) {
  const box = useRef<HTMLDivElement>(null);
  const size = useElementSize(box);
  const [dragging, setDragging] = useState(false);
  const pan = useRef<{ x: number; y: number; fx: number; fy: number; moved: boolean } | null>(null);

  const frameAspect = edit.format === "vertical" ? 9 / 16 : edit.format === "square" ? 1 : natural.w / natural.h;
  const videoAspect = natural.w / natural.h;
  const width = Math.min(size.w, size.h * frameAspect);
  const frame = { w: width, h: width / frameAspect };
  const canPanX = edit.format !== "original" && videoAspect > frameAspect + 0.01;
  const canPanY = edit.format !== "original" && videoAspect < frameAspect - 0.01;
  const pannable = (canPanX || canPanY) && !progress;

  const move = (e: React.PointerEvent) => {
    const p = pan.current;
    if (!p) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) p.moved = true;
    // Dragging by the hidden width (or height) goes from one edge of the picture to the other.
    const hiddenX = frame.h * videoAspect - frame.w;
    const hiddenY = frame.w / videoAspect - frame.h;
    onFocus({
      focusX: canPanX && hiddenX > 0 ? Math.max(0, Math.min(1, p.fx - (e.clientX - p.x) / hiddenX)) : 0.5,
      focusY: canPanY && hiddenY > 0 ? Math.max(0, Math.min(1, p.fy - (e.clientY - p.y) / hiddenY)) : 0.5,
    });
  };

  return (
    <div ref={box} className="relative flex min-h-0 flex-1 items-center justify-center">
      <div
        className={`relative overflow-hidden rounded-[1.25rem] bg-zinc-900 shadow-2xl shadow-black/60 ${pannable ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer"} touch-none`}
        style={{ width: frame.w || "100%", height: frame.h || "100%" }}
        onPointerDown={(e) => {
          if (progress) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          pan.current = { x: e.clientX, y: e.clientY, fx: edit.focusX, fy: edit.focusY, moved: false };
          setDragging(true);
        }}
        onPointerMove={(e) => pannable && move(e)}
        onPointerUp={() => {
          const tapped = pan.current && !pan.current.moved;
          pan.current = null;
          setDragging(false);
          if (tapped) onTogglePlay();
        }}
        onPointerCancel={() => {
          pan.current = null;
          setDragging(false);
        }}
      >
        <video
          ref={video}
          src={src ?? undefined}
          playsInline
          autoPlay
          className="pointer-events-none h-full w-full"
          style={{
            objectFit: edit.format === "original" ? "contain" : "cover",
            objectPosition: `${edit.focusX * 100}% ${edit.focusY * 100}%`,
            filter: previewFilter(edit),
          }}
          {...videoProps}
        />

        {/* Rule-of-thirds guides while reframing */}
        {pannable && dragging && (
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,transparent_33.2%,rgba(255,255,255,0.35)_33.3%,transparent_33.4%,transparent_66.6%,rgba(255,255,255,0.35)_66.7%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.2%,rgba(255,255,255,0.35)_33.3%,transparent_33.4%,transparent_66.6%,rgba(255,255,255,0.35)_66.7%,transparent_66.8%)]" />
        )}
        {pannable && !dragging && (
          <span className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-scrim px-3 py-1.5 text-[11px] font-medium text-fg-on-media backdrop-blur-md">
            <Hand className="h-3.5 w-3.5" /> {t("editor.reposition")}
          </span>
        )}
        {!playing && !progress && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/20 backdrop-blur-md">
              <Play className="ml-1 h-7 w-7" fill="currentColor" />
            </span>
          </span>
        )}
        {progress && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-scrim-strong px-6 text-center text-fg-on-media backdrop-blur-xs" role="status" aria-live="polite">
            <div className="relative h-20 w-20">
              <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#editor-progress)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(progress.percent / 100) * 97.4} 97.4`} className="transition-all duration-300" />
                <defs>
                  <linearGradient id="editor-progress" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold">
                {progress.percent > 0 ? `${progress.percent}%` : <Spinner size="md" className="text-current" />}
              </span>
            </div>
            <span className="max-w-[16rem] text-sm font-semibold">{progress.label}</span>
          </div>
        )}
      </div>
    </div>
  );
});
