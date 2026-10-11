"use client";

import { ServerIcon, WarningIcon } from "@krizaka/icons";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { cn, Progress, Skeleton } from "@/components/ui";
import { formatBytes } from "@/lib/api-errors";
import { type MessageKey,t } from "@/lib/i18n";

/** What GET /api/me/storage answers (lib/storage-usage.ts → StorageOverview). */
export interface StorageView {
  enabled: boolean;
  plan: string;
  used: { bytes: number; seconds: number };
  limit: { bytes: number | null; seconds: number | null };
  percent: number | null;
  percentSeconds: number | null;
  level: "ok" | "warning" | "critical" | "full" | "unlimited";
  held: number;
  platformPaused: boolean;
  uploadsPerDay: number | null;
  uploadsToday: number;
}

const TONE: Record<StorageView["level"], string> = {
  ok: "text-fg-secondary",
  unlimited: "text-fg-secondary",
  warning: "text-warning",
  critical: "text-danger",
  full: "text-danger",
};

const planName = (plan: string) => {
  const key = `quota.plans.${plan}` as MessageKey;
  const label = t(key);
  return label === key ? plan : label;
};

/**
 * The creator's storage gauge: space used against their plan (a @krizaka/ui Progress bar), video time, today's uploads,
 * uploads on hold and a clear message before the limit is reached (80 %, 95 %, full). Reads GET /api/me/storage unless
 * the page already has the figures (`initial`, server-rendered). `compact` for the upload page.
 */
export function StorageMeter({ initial, compact = false, className }: { initial?: StorageView | null; compact?: boolean; className?: string }) {
  const [storage, setStorage] = useState<StorageView | null>(initial ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (initial) return;
    let live = true;
    fetch("/api/me/storage", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { storage: StorageView }) => live && setStorage(body.storage))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [initial]);

  if (failed) return null;
  if (!storage) {
    return (
      <div className={cn("glass-panel rounded-2xl p-5", className)} aria-busy="true">
        <span className="sr-only">{t("quota.loading")}</span>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-2 w-full" />
        <Skeleton className="mt-3 h-3 w-40" />
      </div>
    );
  }

  const limited = storage.enabled && storage.limit.bytes !== null;
  const used = formatBytes(storage.used.bytes);
  const percent = Math.round(storage.percent ?? 0);
  const usedLine = limited ? t("quota.used", { used, limit: formatBytes(storage.limit.bytes ?? 0) }) : t("quota.usedUnlimited", { used });
  const minutes = Math.round(storage.used.seconds / 60);
  const minutesLine =
    storage.enabled && storage.limit.seconds !== null
      ? t("quota.minutes", { used: minutes, limit: Math.round(storage.limit.seconds / 60) })
      : t("quota.minutesUnlimited", { used: minutes });
  const levelLine = storage.enabled ? t(`quota.levels.${storage.level}`, { percent }) : t("quota.off");
  const alarming = storage.level === "warning" || storage.level === "critical" || storage.level === "full";

  return (
    <section className={cn("glass-panel rounded-2xl p-5", className)} aria-labelledby="storage-meter-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="storage-meter-title" className="flex items-center gap-2 text-[11px] font-mono uppercase text-fg-secondary">
          <ServerIcon size={14} />
          {t("quota.title")}
        </h3>
        <span className="text-[11px] text-fg-muted">{t("quota.plan", { plan: planName(storage.plan) })}</span>
      </div>

      <p className="mt-2 font-mono text-lg font-black text-fg">{usedLine}</p>
      {limited && (
        <Progress
          className="mt-2"
          size="sm"
          value={Math.min(storage.used.bytes, storage.limit.bytes ?? 0)}
          max={storage.limit.bytes ?? 1}
          label={t("quota.label")}
          valueText={usedLine}
        />
      )}

      <p className={cn("mt-3 flex items-start gap-1.5 text-xs leading-relaxed", TONE[storage.level])} role={alarming ? "status" : undefined}>
        {alarming && <WarningIcon size={14} className="mt-0.5 shrink-0" />}
        <span>{levelLine}</span>
      </p>

      {storage.platformPaused && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-danger" role="status">
          <WarningIcon size={14} className="mt-0.5 shrink-0" />
          <span>{t("quota.paused")}</span>
        </p>
      )}
      {storage.held > 0 && <p className="mt-2 text-xs leading-relaxed text-warning">{t("quota.held", { count: storage.held })}</p>}

      {!compact && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-muted">
          <span>{minutesLine}</span>
          {storage.uploadsPerDay !== null && <span>{t("quota.today", { count: storage.uploadsToday, max: storage.uploadsPerDay })}</span>}
          {alarming && (
            <Link href="/dashboard?tab=uploads" className="font-semibold text-accent hover:underline focus-visible:underline">
              {t("quota.manage")}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
