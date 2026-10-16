"use client";

import { DescriptionList } from "@krizaka/ui/description-list";
import React from "react";

import { t } from "@/lib/i18n";
import { aspectLabel, qualityOf } from "@/lib/video-quality";

export interface VideoInfoData {
  width?: number | null;
  height?: number | null;
  resolutions?: string[] | null;
  framerate?: number | null;
  durationSeconds: number;
  createdAt: string;
  status?: string | null;
  description?: string | null;
}

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

/** The credit line Orazaka-made clips carry in their description ("Made with Orazaka — run <id> (<model>)."). */
export function creditOf(description?: string | null): string | null {
  const m = description?.match(/Made with Orazaka[^\n]*/);
  return m ? m[0] : null;
}

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING_UPLOAD":
      return t("info.statuses.PENDING_UPLOAD");
    case "PROCESSING":
      return t("info.statuses.PROCESSING");
    case "READY":
      return t("info.statuses.READY");
    case "FAILED":
      return t("info.statuses.FAILED");
    case "HELD":
      return t("info.statuses.HELD");
    default:
      return status;
  }
}

/** What the video is, read from the file (Bunny Stream's metadata kept on the row), never guessed. */
export function VideoInfo({ video }: { video: VideoInfoData }) {
  const q = qualityOf(video.resolutions, video.width, video.height);
  const aspect = aspectLabel(video.width, video.height);
  const credit = creditOf(video.description);
  const dash = t("info.unknown");
  const items = [
    { term: t("info.resolution"), details: video.width && video.height ? `${video.width}×${video.height}${q ? ` · ${q.label}` : ""}` : dash },
    { term: t("info.aspect"), details: aspect ?? dash },
    { term: t("info.duration"), details: clock(video.durationSeconds) },
    { term: t("info.framerate"), details: video.framerate ? t("info.fps", { fps: Number(video.framerate.toFixed(video.framerate % 1 < 0.01 ? 0 : 1)) }) : dash },
    { term: t("info.uploaded"), details: new Date(video.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
    { term: t("info.status"), details: video.status ? statusLabel(video.status) : dash },
    ...(credit ? [{ term: t("info.credit"), details: credit }] : []),
  ];
  return (
    <section aria-label={t("info.title")} data-testid="video-info" className="mt-4 rounded-2xl border border-border-subtle bg-surface-2/30 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-secondary">{t("info.title")}</h2>
      <DescriptionList layout="grid" items={items} />
    </section>
  );
}
