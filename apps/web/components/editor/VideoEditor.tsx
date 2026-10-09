"use client";

import { Crop, Pause, Play, Save, Scissors, SlidersHorizontal, Sparkles, Volume2, VolumeX } from "lucide-react";
import React, { useEffect, useState } from "react";

import { AlertDialog, Button, cn,Dialog, IconButton } from "@/components/ui";
import { type DraftKind, saveDraft } from "@/lib/drafts";
import { t } from "@/lib/i18n";
import { DEFAULT_EDIT, EDITOR_MAX_BYTES, exportEditedVideo,type VideoEdit } from "@/lib/video-edit";

import { clock, useFilmstrip, useObjectUrl, usePreviewPlayer } from "./media";
import { AdjustPanel, FiltersPanel, FormatPanel, PanelHeader, SoundPanel, TrimPanel } from "./panels";
import { Stage, type StageProgress } from "./Stage";
import { type Tool, TOOLS, useEditState } from "./useEditState";

type Details = Record<string, string | number | boolean | string[] | null>;

const STORY_SECONDS = 60;
const TOOL_ICONS: Record<Tool, React.ElementType> = { trim: Scissors, filters: Sparkles, adjust: SlidersHorizontal, format: Crop, sound: Volume2 };

/** Which tools hold changes (a dot on the tool bar; a Reset in the panel). */
function changedTools(edit: VideoEdit, duration: number, maxSeconds: number | undefined, story: boolean): Record<Tool, boolean> {
  const fullEnd = maxSeconds ? Math.min(duration, maxSeconds) : duration;
  return {
    trim: edit.startSeconds > 0.05 || Math.abs(edit.endSeconds - fullEnd) > 0.05 || edit.speed !== 1,
    filters: edit.filter !== "none",
    adjust: edit.brightness !== 0 || edit.contrast !== 0 || edit.saturation !== 0,
    format: (!story && edit.format !== "original") || edit.focusX !== 0.5 || edit.focusY !== 0.5,
    sound: edit.volume !== 1 || edit.fadeIn || edit.fadeOut || edit.denoise || Boolean(edit.music) || edit.musicVolume !== DEFAULT_EDIT.musicVolume,
  };
}

/**
 * The video editor shown before an upload — dark in both themes, like every media editor. Phones and stories get one
 * column (picture, the open tool, a tool bar); videos on a wide screen get the picture beside the tools. Trim
 * (filmstrip, handles, speed) · Filters · Adjust · Format (drag the picture to reframe) · Sound (volume, fades, noise
 * reduction, music). Stories are always vertical 9:16 and at most 60 seconds.
 *
 * Non-destructive: the caller keeps the original and reopens it with the last settings. "Done" renders the result in
 * the browser (ffmpeg.wasm); "Save draft" keeps the original, the settings and `details` (the form) on the server.
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
  /** Settings to start from (a resumed draft, or the last edit of this clip). */
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
  const wide = !story;
  const { edit, set, patch, duration, loaded, setStart, setEnd, reset, dirty, keptSeconds } = useEditState({ initial: initialEdit, lockedFormat: story ? "vertical" : undefined, maxSeconds });

  const src = useObjectUrl(file);
  const musicUrl = useObjectUrl(edit.music);
  const frames = useFilmstrip(src, duration);
  const [natural, setNatural] = useState({ w: 16, h: 9 });
  const [time, setTime] = useState(0);
  const player = usePreviewPlayer({ speed: edit.speed, volume: edit.volume, musicVolume: edit.musicVolume, musicUrl });
  const { video: videoRef, music: musicRef, playing, toggle: togglePlay } = player;
  const [tool, setTool] = useState<Tool>("trim");
  const [task, setTask] = useState<{ kind: "render" | "draft"; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const tooLarge = file.size > EDITOR_MAX_BYTES;
  const busy = task !== null;


  const seek = (s: number) => {
    player.seek(s);
    setTime(s);
  };
  // The preview loops on the kept part, and the music restarts with it.
  const onTimeUpdate = () => setTime(player.keepWithin(edit.startSeconds, edit.endSeconds));

  const keepDraft = async () => {
    setError(null);
    setTask({ kind: "draft", percent: 0 });
    player.pause();
    try {
      const id = await saveDraft({ kind, file, edit, details, draftId, musicChanged: edit.music !== (initialEdit?.music ?? null) }, (percent) => setTask({ kind: "draft", percent }));
      onClose(id);
    } catch (e) {
      console.error("video editor: draft not saved", e);
      setError(e instanceof Error && e.message ? `${t("editor.draftFailed")} ${e.message}` : t("editor.draftFailed"));
      setTask(null);
      setLeaving(false);
    }
  };

  const done = async () => {
    setError(null);
    setTask({ kind: "render", percent: 0 });
    player.pause();
    try {
      onApply(await exportEditedVideo(file, edit, (percent) => setTask({ kind: "render", percent })), edit);
    } catch (e) {
      console.error("video editor: export failed", e);
      setError(t("editor.failed"));
      setTask(null);
    }
  };

  const cancel = () => (dirty ? setLeaving(true) : onClose());

  // Keyboard: Space plays / pauses (outside fields and buttons). Escape leaves and the page stays still: the dialog does both.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (busy || (e.target as HTMLElement).closest("input, textarea, select, button, [role=switch]")) return;
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const changed = changedTools(edit, duration, maxSeconds, story);
  const progress: StageProgress | null = task
    ? { percent: task.percent, label: task.kind === "draft" ? t("editor.savingDraft", { progress: task.percent }) : task.percent > 0 ? t("editor.exporting", { progress: task.percent }) : t("editor.loading") }
    : null;

  const panel = (
    <>
      <PanelHeader tool={tool} changed={changed[tool]} onReset={() => reset(tool)} />
      {tool === "trim" && (
        <TrimPanel
          edit={edit}
          set={set}
          frames={frames}
          duration={duration}
          time={time}
          maxSeconds={maxSeconds}
          onStart={(s) => {
            setStart(s);
            seek(Math.max(0, Math.min(s, edit.endSeconds - 0.5)));
          }}
          onEnd={(s) => {
            setEnd(s);
            seek(Math.max(edit.startSeconds, s - 1));
          }}
          onSeek={seek}
        />
      )}
      {tool === "filters" && <FiltersPanel edit={edit} set={set} frames={frames} />}
      {tool === "adjust" && <AdjustPanel edit={edit} set={set} />}
      {tool === "format" && <FormatPanel edit={edit} locked={story} onFormat={(format) => patch({ format, focusX: 0.5, focusY: 0.5 })} />}
      {tool === "sound" && <SoundPanel edit={edit} set={set} />}
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );

  const toolbar = (
    <nav aria-label={t("editor.toolsLabel")} className={cn("grid grid-cols-5 gap-1", wide && "lg:border-b lg:border-border-default lg:pb-2")}>
      {TOOLS.map((id) => {
        const Icon = id === "sound" && edit.volume === 0 && !edit.music ? VolumeX : TOOL_ICONS[id];
        const active = tool === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setTool(id)}
            aria-current={active ? "true" : undefined}
            className={cn(
              "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-surface-2 text-fg" : "text-fg-secondary hover:bg-surface-1 hover:text-fg",
            )}
          >
            <Icon className="h-5 w-5" />
            {t(`editor.tools.${id}`)}
            {changed[id] && <span className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
          </button>
        );
      })}
    </nav>
  );

  return (
    <Dialog.Root open onOpenChange={(open) => !open && !busy && cancel()}>
      <Dialog.Content
        size="lg"
        hideClose
        dismissible={false}
        aria-describedby={undefined}
        // Escape asks the editor to cancel (it confirms when there are changes), unless a render is running.
        onEscapeKeyDown={() => {
          if (!busy) cancel();
        }}
        className={cn(
          "theme-dark h-dvh max-h-dvh w-full rounded-none border-0 bg-surface-0 shadow-2xl sm:h-[min(94vh,920px)] sm:max-h-none sm:rounded-4xl sm:border sm:border-border-default",
          wide ? "sm:max-w-2xl lg:max-w-6xl" : "sm:max-w-120",
        )}
      >
        {/* Header: Cancel · title · Save draft · Done */}
        <header className="flex items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:pt-4">
          <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
            {t("editor.cancel")}
          </Button>
          <Dialog.Title className="min-w-0 flex-1 truncate text-center text-sm font-bold">
            {t(story ? "editor.titleStory" : "editor.title")}
          </Dialog.Title>
          <IconButton label={t("editor.saveDraft")} onClick={keepDraft} disabled={busy || tooLarge || duration === 0} className="sm:hidden">
            <Save className="h-4 w-4" />
          </IconButton>
          <Button
            variant="secondary"
            size="sm"
            onClick={keepDraft}
            disabled={busy || tooLarge || duration === 0}
            className="hidden sm:inline-flex"><Save className="h-3.5 w-3.5" />
            {t("editor.saveDraft")}
          </Button>
          <Button variant="sensual" size="sm" onClick={done} loading={task?.kind === "render"} disabled={busy || tooLarge || duration === 0}>
            {t(story ? "editor.next" : "editor.done")}
          </Button>
        </header>

        {tooLarge ? (
          <p className="m-6 rounded-2xl border border-border-default p-6 text-sm text-fg-secondary">{t("editor.tooLarge")}</p>
        ) : (
          <div className={cn("flex min-h-0 flex-1 flex-col", wide && "lg:flex-row")}>
            {/* The picture and its transport */}
            <section className={cn("flex min-h-0 flex-1 flex-col px-3 sm:px-4", wide && "lg:pb-4")} aria-label={t("editor.preview")}>
              <Stage
                ref={videoRef}
                src={src}
                edit={edit}
                natural={natural}
                playing={playing}
                progress={progress}
                onTogglePlay={togglePlay}
                onFocus={patch}
                videoProps={{
                  onLoadedMetadata: (e) => {
                    const v = e.currentTarget;
                    setNatural({ w: v.videoWidth || 16, h: v.videoHeight || 9 });
                    loaded(v.duration);
                  },
                  onTimeUpdate,
                  onPlay: () => player.setPlaying(true),
                  onPause: () => player.setPlaying(false),
                }}
              />
              <div className="flex items-center justify-center gap-3 py-2">
                <IconButton label={playing ? t("editor.pause") : t("editor.play")} onClick={togglePlay} disabled={busy || duration === 0} className="h-9 w-9">
                  {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="ml-0.5 h-4 w-4" fill="currentColor" />}
                </IconButton>
                <span className="font-mono text-xs tabular-nums text-fg-secondary">
                  <span className="text-fg">{clock(Math.max(0, time - edit.startSeconds) / edit.speed)}</span> / {clock(keptSeconds)}
                </span>
              </div>
              {musicUrl && <audio ref={musicRef} src={musicUrl} loop preload="auto" />}
            </section>

            {/* The open tool and the tool bar (tool bar at the bottom on phones, on top of the panel on wide screens) */}
            <aside className={cn("flex shrink-0 flex-col border-t border-border-default bg-surface-0", wide && "lg:w-[380px] lg:border-l lg:border-t-0")}>
              <div className={cn("order-2 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1", wide && "lg:order-1 lg:px-4 lg:pb-0 lg:pt-4")}>{toolbar}</div>
              <div className={cn("order-1 max-h-[40dvh] min-h-40 overflow-y-auto overscroll-contain px-4 pb-2 pt-4", wide && "lg:order-2 lg:max-h-none lg:flex-1 lg:pb-6")}>{panel}</div>
            </aside>
          </div>
        )}

        {/* Leaving with changes: keep them as a draft, drop them, or stay */}
        <AlertDialog
          open={leaving}
          onOpenChange={(open) => !open && !busy && setLeaving(false)}
          title={t("editor.discard.title")}
          description={t("editor.discard.body")}
          tone="danger"
          confirmLabel={t("editor.discard.discard")}
          cancelLabel={t("editor.discard.keep")}
          onConfirm={() => onClose()}
          className="theme-dark"
        >
          <Button variant="sensual" size="lg" className="w-full" onClick={keepDraft} loading={task?.kind === "draft"}>
            <Save className="h-4 w-4" aria-hidden />
            {t("editor.saveDraft")}
          </Button>
        </AlertDialog>
      </Dialog.Content>
    </Dialog.Root>
  );
}
