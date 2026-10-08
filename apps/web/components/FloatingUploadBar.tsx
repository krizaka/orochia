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
          className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-zinc-950/95 border border-violet-500/30 text-white shadow-2xl backdrop-blur-xl hover:border-violet-500/60 transition-all light:bg-white light:border-violet-500/30 light:text-slate-900 group"
          title={t("uploads.expand")}
        >
          <div className="relative flex items-center justify-center">
            {activeCount > 0 ? (
              <div className="h-4 w-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          <span className="text-xs font-semibold">
            {activeCount > 0 ? t("uploads.uploading", { progress: totalProgress }) : t("uploads.complete")}
          </span>
          <span className="text-[10px] bg-violet-600/30 text-violet-300 font-mono px-2 py-0.5 rounded-full">
            {uploads.length}
          </span>
          <ChevronUp className="h-3.5 w-3.5 text-zinc-400 group-hover:text-white group-hover:light:text-slate-900 transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label={t("uploads.label")}
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 rounded-2xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-2xl light:bg-white/95 light:border-black/10 light:text-slate-900"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 light:border-black/10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-tr from-violet-600 to-fuchsia-600 text-white shadow-xs">
            <UploadCloud className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider light:text-slate-900">
              {t("uploads.title")}
            </h4>
            <p className="text-[10px] text-zinc-400 light:text-slate-500">
              {activeCount > 0 ? t("uploads.running", { count: activeCount }) : t("uploads.finished")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsDockMinimized(true)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors hover:light:text-slate-900 hover:light:bg-black/5"
            title={t("uploads.minimize")} aria-label={t("uploads.minimize")}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Upload Items List */}
      <div className="mt-3 space-y-3 max-h-72 overflow-y-auto pr-1">
        {uploads.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-white/5 bg-zinc-900/60 p-3 light:bg-slate-50 light:border-black/5"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                {item.type === "story" ? (
                  <Sparkles className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />
                ) : (
                  <Film className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                )}
                <span className="text-xs font-semibold text-white truncate light:text-slate-900">
                  {item.title}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {item.status === "uploading" && (
                  <button
                    onClick={() => pauseUpload(item.id)}
                    className="p-1 rounded-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors hover:light:text-slate-900"
                    title={t("uploads.pause")} aria-label={t("uploads.pause")}
                  >
                    <Pause className="h-3 w-3" />
                  </button>
                )}
                {item.status === "paused" && (
                  <button
                    onClick={() => resumeUpload(item.id)}
                    className="p-1 rounded-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                    title={t("uploads.resume")} aria-label={t("uploads.resume")}
                  >
                    <Play className="h-3 w-3" />
                  </button>
                )}
                {item.status !== "completed" && (
                  <button
                    onClick={() => cancelUpload(item.id)}
                    className="p-1 rounded-sm text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title={t("uploads.cancel")} aria-label={t("uploads.cancel")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
                {item.status === "completed" && (
                  <button
                    onClick={() => dismissUpload(item.id)}
                    className="p-1 rounded-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors hover:light:text-slate-900"
                    title={t("uploads.dismiss")} aria-label={t("uploads.dismiss")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800 light:bg-slate-200 mb-2">
              <div
                className={`h-full transition-all duration-300 ${
                  item.status === "completed"
                    ? "bg-emerald-500"
                    : item.status === "error"
                    ? "bg-rose-500"
                    : item.status === "paused"
                    ? "bg-amber-500"
                    : "bg-linear-to-r from-violet-600 via-fuchsia-600 to-pink-600"
                }`}
                style={{ width: `${item.progress}%` }}
              />
            </div>

            {/* Stats / Status Row */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 light:text-slate-500">
              <span>
                {item.status === "uploading" && (
                  <>
                    <span className="font-mono text-violet-400 font-semibold">{item.progress}%</span>
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
                  <span className="text-amber-400 font-medium">{t("uploads.paused", { progress: item.progress })}</span>
                )}
                {item.status === "completed" && (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 inline" /> {t("uploads.processing")}
                  </span>
                )}
                {item.status === "error" && (
                  <span className="text-rose-400 font-medium flex items-center gap-1 truncate max-w-[200px]">
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
                  className="text-[11px] text-violet-400 hover:text-violet-300 font-semibold transition-colors"
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
