"use client";

import Link from "next/link";
import React from "react";

import { useMeData } from "@/components/me/MeData";
import { EmptyState, Skeleton } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

const duration = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

/** The videos you unlocked: media first, a poster and one line each. */
export default function MeLibrary() {
  const { t, money, date } = useI18n();
  const { data } = useMeData();
  if (!data) return <Skeleton shape="rect" className="h-48 rounded-2xl" />;
  if (data.library.length === 0) return <EmptyState bird="owl" title={t("dashboard.libraryEmpty")} />;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-4">
      {data.library.map((video) => (
        <li key={video.id}>
          <Link href={`/watch/${video.id}`} className="group block">
            <div className="aspect-video overflow-hidden rounded-xl bg-surface-3">
              {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform" />}
            </div>
            <h3 className="mt-2 line-clamp-1 text-sm font-bold text-fg">{video.title}</h3>
            <p className="text-xs text-fg-secondary">{video.creatorName}</p>
            <p className="font-mono text-[11px] text-fg-muted">{duration(video.durationSeconds)} · {t("dashboard.unlockedOn", { date: date(video.unlockedAt) })} · {money(video.amountPaidCents)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
