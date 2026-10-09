"use client";

import React from "react";
import Link from "next/link";
import {
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  X,
  CheckCircle,
  AlertCircle,
  Film,
  Sparkles,
} from "lucide-react";
import { useUploadManager, type UploadItem } from "@/lib/upload-manager";
import { t } from "@/lib/i18n";
import { cn, IconButton, Spinner } from "@/components/ui";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "--";
  if (bytesPerSec >= 1024 ** 2) return `${(bytesPerSec / 1024 ** 2).toFixed(1)} MB/s`;
  return `${Math.round(bytesPerSec / 1024)} KB/s`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "";
  if (seconds < 60) return `${seconds}s left`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s left`;
}

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

  if (uploads.length === 0) return null;

  const activeCount = uploads.filter(
    (u) => u.status === "uploading" || u.status === "queued" || u.status === "paused"
  ).length;

  const totalProgress =
    uploads.length > 0
      ? Math.round(uploads.reduce((acc, u) => acc + u.progress, 0) / uploads.length)
      : 0;

  if (isDockMinimized) {
    return (
      <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50">
        <button
          onClick={() => setIsDockMinimized(false)}
          className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-surface-1/95 border border-accent/30 text-fg shadow-2xl backdrop-blur-xl hover:border-accent/60 transition-all group"
          title={t("uploads.expand")}
        >
          <div className="relative flex items-center justify-center">
            {activeCount > 0 ? (
              <Spinner size="sm" />
            ) : (
              <CheckCircle className="h-4 w-4 text-success" />
            )}
          </div>
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
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 rounded-2xl border border-border-default bg-surface-1/95 p-4 shadow-2xl backdrop-blur-2xl light:text-slate-900"
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

            {/* Progress Bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3 mb-2">
              <div
                className={cn("h-full transition-all duration-300", item.status === "completed"
                  ? "bg-success"
                  : item.status === "error"
                  ? "bg-danger"
                  : item.status === "paused"
                  ? "bg-warning"
                  : "bg-linear-to-r from-accent via-accent-2 to-accent-2")}
                style={{ width: `${item.progress}%` }}
              />
            </div>

            {/* Stats / Status Row */}
            <div className="flex items-center justify-between text-[11px] text-fg-secondary">
              <span>
                {item.status === "uploading" && (
                  <>
                    <span className="font-mono text-accent font-semibold">{item.progress}%</span>
                    {" • "}
                    <span>{formatSpeed(item.speedBytesPerSec)}</span>
                    {item.timeRemainingSec && (
                      <>
                        {" • "}
                        <span>{formatEta(item.timeRemainingSec)}</span>
                      </>
                    )}
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

              <span className="font-mono text-[10px]">
                {formatBytes(item.bytesUploaded)} / {formatBytes(item.bytesTotal)}
              </span>
            </div>

            {item.status === "completed" && item.videoId && (
              <div className="mt-2 pt-2 border-t border-white/5 flex justify-end">
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
