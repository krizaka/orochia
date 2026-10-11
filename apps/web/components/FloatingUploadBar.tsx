"use client";

import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Film,
  Pause,
  Play,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef } from "react";

import { IconButton, Progress, progressToast, toast } from "@/components/ui";
import { t } from "@/lib/i18n";
import { bytes, duration, speed } from "@/lib/units";
import { useUploadManager } from "@/lib/upload-manager";

const STATUS = { uploading: "active", queued: "active", paused: "paused", error: "error", completed: "active" } as const;

/** “About 2 min left”, or nothing while the speed is not known. */
const etaOf = (seconds: number | null) => {
  const left = duration(seconds);
  return left ? t("uploads.eta", { time: left }) : undefined;
};

/**
 * The upload dock: every upload with its bar (percentage, time left, paused or failed), pause / resume / cancel. Minimized,
 * the uploads keep going in one toast that advances (`progressToast`) and turns to a success at the end; its action
 * opens the dock again.
 */
export function FloatingUploadBar() {
  const {
    uploads,
    isDockMinimized,
    setIsDockMinimized,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    dismissUpload,
  } = useUploadManager();

  const activeCount = uploads.filter(
    (u) => u.status === "uploading" || u.status === "queued" || u.status === "paused"
  ).length;

  const totalProgress =
    uploads.length > 0
      ? Math.round(uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length)
      : 0;
  const failed = uploads.some((u) => u.status === "error");
  const slowest = Math.max(0, ...uploads.map((u) => (u.status === "uploading" ? (u.timeRemainingSec ?? 0) : 0)));

  // Minimized: one toast carries the uploads in the background, until they are done (or the dock opens again).
  const toastId = useRef<string | number | null>(null);
  const tracking = isDockMinimized && uploads.length > 0;
  useEffect(() => {
    if (!tracking) {
      if (toastId.current !== null) toast.dismiss(toastId.current);
      toastId.current = null;
      return;
    }
    if (activeCount === 0 && toastId.current === null) return;
    if (activeCount === 0 && failed) {
      toast.error(t("uploads.failed"), { id: toastId.current ?? undefined, action: { label: t("uploads.expand"), onClick: () => setIsDockMinimized(false) } });
      return;
    }
    toastId.current = progressToast(t("uploads.running", { count: Math.max(1, activeCount) }), {
      id: toastId.current ?? undefined,
      value: activeCount === 0 ? 1 : totalProgress / 100,
      description: etaOf(slowest),
      doneMessage: t("uploads.processing"),
      action: { label: t("uploads.expand"), onClick: () => setIsDockMinimized(false) },
    });
  }, [tracking, activeCount, failed, totalProgress, slowest, setIsDockMinimized]);

  if (uploads.length === 0) return null;

  if (isDockMinimized) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50">
        <button
          onClick={() => setIsDockMinimized(false)}
          className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-surface-1/95 border border-accent/30 text-fg shadow-2xl backdrop-blur-xl hover:border-accent/60 transition-all group"
          title={t("uploads.expand")}
        >
          <Progress variant="ring" size="sm" value={activeCount > 0 ? totalProgress : 100} label={t("uploads.label")} className="h-6 w-6" />
          <span className="text-xs font-semibold">
            {activeCount > 0 ? t("uploads.uploading", { progress: totalProgress }) : t("uploads.complete")}
          </span>
          <span className="text-[10px] bg-accent/30 text-accent font-mono px-2 py-0.5 rounded-full">
            {uploads.length}
          </span>
          <ChevronUp className="h-3.5 w-3.5 text-fg-secondary group-hover:text-fg transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label={t("uploads.label")}
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 rounded-2xl border border-border-default bg-surface-1/95 p-4 shadow-2xl text-fg backdrop-blur-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-default">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-tr from-accent to-accent-2 text-white shadow-xs">
            <UploadCloud className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-fg uppercase tracking-wider">
              {t("uploads.title")}
            </h4>
            <p className="text-[10px] text-fg-secondary">
              {activeCount > 0 ? t("uploads.running", { count: activeCount }) : t("uploads.finished")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <IconButton onClick={() => setIsDockMinimized(true)} shape="rounded" className="h-7 w-7" label={t("uploads.minimize")}>
            <ChevronDown className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      {/* Upload Items List */}
      <div className="mt-3 space-y-3 max-h-72 overflow-y-auto pr-1">
        {uploads.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-border-subtle bg-surface-2/60 p-3"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {item.type === "story" ? (
                  <Sparkles className="h-3.5 w-3.5 text-accent shrink-0" />
                ) : (
                  <Film className="h-3.5 w-3.5 text-accent shrink-0" />
                )}
                <span className="text-xs font-semibold text-fg truncate">
                  {item.title}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {item.status === "uploading" && (
                  <IconButton
                    onClick={() => pauseUpload(item.id)}
                    shape="rounded"
                    className="h-6 w-6"
                    label={t("uploads.pause")}
                  >
                    <Pause className="h-3 w-3" aria-hidden />
                  </IconButton>
                )}
                {item.status === "paused" && (
                  <IconButton
                    onClick={() => resumeUpload(item.id)}
                    shape="rounded"
                    className="h-6 w-6 text-success hover:bg-success/10 hover:text-success"
                    label={t("uploads.resume")}
                  >
                    <Play className="h-3 w-3" aria-hidden />
                  </IconButton>
                )}
                {item.status !== "completed" && (
                  <IconButton
                    onClick={() => cancelUpload(item.id)}
                    shape="rounded"
                    className="h-6 w-6 hover:bg-danger/10 hover:text-danger"
                    label={t("uploads.cancel")}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </IconButton>
                )}
                {item.status === "completed" && (
                  <IconButton
                    onClick={() => dismissUpload(item.id)}
                    shape="rounded"
                    className="h-6 w-6"
                    label={t("uploads.dismiss")}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </IconButton>
                )}
              </div>
            </div>

            <Progress
              value={item.progress}
              max={100}
              size="sm"
              label={item.title}
              status={STATUS[item.status]}
              eta={item.status === "uploading" ? etaOf(item.timeRemainingSec) : undefined}
              className="mb-2"
            />

            {/* Stats / Status Row */}
            <div className="flex items-center justify-between gap-2 text-[11px] text-fg-secondary">
              <span className="min-w-0">
                {item.status === "uploading" && (
                  <>
                    <span className="font-mono font-semibold text-fg-accent">{item.progress}%</span>
                    {speed(item.speedBytesPerSec) && <span> · {speed(item.speedBytesPerSec)}</span>}
                    {etaOf(item.timeRemainingSec) && <span> · {etaOf(item.timeRemainingSec)}</span>}
                  </>
                )}
                {item.status === "paused" && (
                  <span className="text-warning font-medium">{t("uploads.paused", { progress: item.progress })}</span>
                )}
                {item.status === "completed" && (
                  <span className="text-success font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 inline" /> {t("uploads.processing")}
                  </span>
                )}
                {item.status === "error" && (
                  <span className="text-danger font-medium flex items-center gap-1 truncate max-w-[200px]">
                    <AlertCircle className="h-3 w-3 inline shrink-0" />{" "}
                    {item.errorMessage || t("uploads.failed")}
                  </span>
                )}
              </span>

              <span className="shrink-0 font-mono text-[10px]">
                {bytes(item.bytesUploaded)} / {bytes(item.bytesTotal)}
              </span>
            </div>

            {item.status === "completed" && item.videoId && (
              <div className="mt-2 pt-2 border-t border-border-subtle flex justify-end">
                <Link
                  href={`/watch/${item.videoId}`}
                  className="text-[11px] text-accent hover:text-accent font-semibold transition-colors"
                >
                  {t("uploads.view")}
                </Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
