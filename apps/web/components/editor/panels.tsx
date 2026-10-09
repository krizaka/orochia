"use client";

import React from "react";
import { Check, Lock, Music2, RotateCcw, Trash2, Volume2, VolumeX, Wand2 } from "lucide-react";
import { SPEEDS, VIDEO_FILTERS, previewFilter, type VideoEdit, type VideoFilter, type VideoFormat } from "@/lib/video-edit";
import { Chip, IconButton, Segmented, Slider } from "@/components/ui";
import { FILMSTRIP_FRAMES } from "./media";
import { Timeline } from "./Timeline";
import type { Tool } from "./useEditState";
import { t } from "@/lib/i18n";

type Setter = <K extends keyof VideoEdit>(key: K, value: VideoEdit[K]) => void;

/** Title, one-line guidance and — when something changed — a reset, at the top of every tool. */
export function PanelHeader({ tool, changed, onReset }: { tool: Tool; changed: boolean; onReset: () => void }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-bold text-white">{t(`editor.panels.${tool}.title`)}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-secondary">{t(`editor.panels.${tool}.hint`)}</p>
      </div>
      {changed && (
        <button type="button" onClick={onReset} className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:bg-white/8 hover:text-white">
          <RotateCcw className="h-3 w-3" /> {t("editor.reset")}
        </button>
      )}
    </div>
  );
}

export function TrimPanel(props: {
  edit: VideoEdit;
  set: Setter;
  frames: string[];
  duration: number;
  time: number;
  maxSeconds?: number;
  onStart: (s: number) => void;
  onEnd: (s: number) => void;
  onSeek: (s: number) => void;
}) {
  const { edit, set, maxSeconds } = props;
  return (
    <div className="space-y-4">
      <Timeline frames={props.frames} duration={props.duration} start={edit.startSeconds} end={edit.endSeconds} time={props.time} onStart={props.onStart} onEnd={props.onEnd} onSeek={props.onSeek} />
      {maxSeconds && <p className="text-[11px] text-fg-muted">{t("editor.maxLength", { seconds: maxSeconds })}</p>}
      <div>
        <span className="mb-2 block text-xs font-semibold text-zinc-300">{t("editor.speed")}</span>
        <div className="flex flex-wrap gap-2">
          {SPEEDS.map((s) => (
            <Chip key={s} active={edit.speed === s} onClick={() => set("speed", s)} className="min-w-14">
              {s}×
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FiltersPanel({ edit, set, frames }: { edit: VideoEdit; set: Setter; frames: string[] }) {
  const frame = frames[Math.min(frames.length - 1, Math.floor(FILMSTRIP_FRAMES / 2))];
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
      {(Object.keys(VIDEO_FILTERS) as VideoFilter[]).map((name) => {
        const active = edit.filter === name;
        return (
          <button key={name} type="button" onClick={() => set("filter", name)} aria-pressed={active} className="group flex w-18 shrink-0 snap-start flex-col items-center gap-1.5 lg:w-auto">
            <span className={`relative block aspect-square w-full overflow-hidden rounded-2xl ring-2 ring-offset-2 ring-offset-zinc-950 transition-all ${active ? "ring-white" : "ring-transparent group-hover:ring-white/30"}`}>
              {frame ? (
                <img src={frame} alt="" className="h-full w-full object-cover" style={{ filter: previewFilter({ filter: name, brightness: 0, contrast: 0, saturation: 0 }) }} />
              ) : (
                <span className="block h-full w-full animate-pulse bg-white/10" />
              )}
              {active && (
                <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-zinc-900">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
            </span>
            <span className={`text-[11px] font-semibold ${active ? "text-white" : "text-fg-secondary"}`}>{t(`editor.filterNames.${name}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function AdjustPanel({ edit, set }: { edit: VideoEdit; set: Setter }) {
  return (
    <div className="space-y-5">
      {(["brightness", "contrast", "saturation"] as const).map((key) => (
        <Slider
          key={key}
          label={t(`editor.adjust.${key}`)}
          value={edit[key]}
          min={-0.5}
          max={0.5}
          step={0.01}
          reset={0}
          display={`${edit[key] > 0 ? "+" : ""}${Math.round(edit[key] * 100)}`}
          onChange={(v) => set(key, v)}
        />
      ))}
    </div>
  );
}

const FORMAT_SHAPE: Record<VideoFormat, string> = { original: "h-5 w-8", vertical: "h-8 w-[1.15rem]", square: "h-6 w-6" };

export function FormatPanel({ edit, onFormat, locked }: { edit: VideoEdit; onFormat: (f: VideoFormat) => void; locked: boolean }) {
  if (locked) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/3 p-4">
        <span className={`block rounded-[4px] border-2 border-white ${FORMAT_SHAPE.vertical}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{t("editor.formats.vertical")}</p>
          <p className="text-xs text-fg-secondary">{t("editor.storyVertical")}</p>
        </div>
        <Lock className="h-4 w-4 text-fg-muted" />
      </div>
    );
  }
  return (
    <Segmented
      label={t("editor.panels.format.title")}
      value={edit.format}
      onChange={onFormat}
      options={(["original", "vertical", "square"] as const).map((f) => ({
        value: f,
        label: (
          <span className="flex flex-col items-center gap-2 py-1">
            <span className={`block rounded-[4px] border-2 border-current ${FORMAT_SHAPE[f]}`} />
            {t(`editor.formats.${f}`)}
          </span>
        ),
      }))}
    />
  );
}

export function SoundPanel({ edit, set }: { edit: VideoEdit; set: Setter }) {
  const muted = edit.volume === 0;
  return (
    <div className="space-y-5">
      <div className="flex items-end gap-2">
        <IconButton label={muted ? t("editor.sound.unmute") : t("editor.sound.mute")} onClick={() => set("volume", muted ? 1 : 0)} className="mb-[-2px] border border-white/10">
          {muted ? <VolumeX className="h-4 w-4 text-danger" /> : <Volume2 className="h-4 w-4" />}
        </IconButton>
        <div className="flex-1">
          <Slider label={t("editor.sound.volume")} value={edit.volume} min={0} max={2} step={0.05} reset={1} display={muted ? t("editor.sound.muted") : `${Math.round(edit.volume * 100)} %`} onChange={(v) => set("volume", v)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["fadeIn", "fadeOut", "denoise"] as const).map((key) => (
          <Chip key={key} active={edit[key]} onClick={() => set(key, !edit[key])}>
            {key === "denoise" && <Wand2 className="h-3.5 w-3.5" />}
            {t(`editor.sound.${key}`)}
          </Chip>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <Music2 className="h-4 w-4 text-accent" /> {t("editor.sound.music")}
        </p>
        {edit.music ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
              <Music2 className="h-4 w-4 shrink-0 text-fg-secondary" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{edit.music.name}</span>
              <IconButton label={t("editor.sound.removeMusic")} onClick={() => set("music", null)} className="h-8 w-8 hover:text-danger">
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
            <Slider label={t("editor.sound.musicVolume")} value={edit.musicVolume} min={0} max={1} step={0.05} reset={0.6} display={`${Math.round(edit.musicVolume * 100)} %`} onChange={(v) => set("musicVolume", v)} />
          </div>
        ) : (
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/10 focus-within:ring-2 focus-within:ring-ring">
            <Music2 className="h-4 w-4" /> {t("editor.sound.addMusic")}
            <input type="file" accept="audio/*" className="sr-only" onChange={(e) => e.target.files?.[0] && set("music", e.target.files[0])} />
          </label>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-fg-muted">{t("editor.sound.musicHint")}</p>
      </div>
    </div>
  );
}
