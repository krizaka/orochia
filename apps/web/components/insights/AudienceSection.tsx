"use client";

import { Funnel } from "@krizaka/charts/funnel";
import { Heatmap } from "@krizaka/charts/heatmap";
import { AreaChart } from "@krizaka/charts/line";
import { Stat, StatGrid } from "@krizaka/ui/stat";
import Link from "next/link";
import React from "react";

import { EmptyState } from "@/components/ui";
import { t } from "@/lib/i18n";
import { AudienceStatus, type AudienceView } from "@/lib/analytics/analytics.view";

/** A funnel step's words: the kinds Orochia sends, else the kind as Orazaka names it. */
function kindLabel(kind: string): string {
  const labels: Record<string, string> = {
    view: t("insights.audience28.kinds.view"),
    like: t("insights.audience28.kinds.like"),
    save: t("insights.audience28.kinds.save"),
    share: t("insights.audience28.kinds.share"),
    tip: t("insights.audience28.kinds.tip"),
    unlock: t("insights.audience28.kinds.unlock"),
  };
  return labels[kind] ?? kind;
}

const card = "rounded-3xl border border-border-default bg-surface-1/60 p-5 shadow-xs";

/**
 * The creator's audience (ADR-081, served by the platform's analytics): five figures against the period before, the days, the view → like → tip funnel,
 * the videos most people engaged and the weekly cohorts — computed server side, never a person, nothing under the
 * audience threshold.
 */
export function AudienceSection({ view, days }: { view: AudienceView; days: number }) {
  if (view.status === AudienceStatus.Off) return null;
  if (view.status !== AudienceStatus.Ok) {
    return (
      <section className={card} aria-label={t("insights.audience28.title", { days })}>
        <EmptyState
          bird="owl"
          title={view.status === AudienceStatus.TooSmall ? t("insights.audience28.smallTitle") : t("insights.unavailableTitle")}
          description={
            view.status === AudienceStatus.TooSmall ? t("insights.audience28.smallBody", { min: view.minAudience }) : t("insights.unavailableBody")
          }
        />
      </section>
    );
  }
  const cells = view.cohorts.flatMap((c) => c.retentionPct.map((pct, week) => ({ cohort: c.week, week: t("insights.audience28.weekN", { n: week }), pct })));
  return (
    <section className={card} aria-labelledby="audience-title">
      <h2 id="audience-title" className="text-sm font-bold text-fg">
        {t("insights.audience28.title", { days })}
      </h2>
      <p className="mt-1 text-[11px] text-fg-muted">{t("insights.audience28.hint", { min: view.minAudience })}</p>
      <StatGrid className="mt-4" minWidth={150}>
        {view.tiles.map((tile) => (
          <Stat
            key={tile.key}
            label={t(`insights.audience28.tiles.${tile.key}`)}
            value={tile.value === null ? t("insights.audience28.hidden", { min: view.minAudience }) : tile.key === "watched" ? `${tile.value} %` : tile.value}
            trend={tile.changePct === null ? undefined : tile.trend}
            trendLabel={tile.changePct === null ? undefined : `${tile.changePct > 0 ? "+" : ""}${tile.changePct} %`}
            hint={tile.changePct === null ? undefined : t("insights.audience28.vsBefore")}
          />
        ))}
      </StatGrid>
      <div className="mt-6">
        <AreaChart
          title={t("insights.audience28.daily")}
          data={view.series}
          x="day"
          xFormat="day"
          xLabel={t("insights.audience28.day")}
          series={[
            { key: "views", label: t("insights.audience28.tiles.views") },
            { key: "likes", label: t("insights.audience28.tiles.likes") },
          ]}
          height={220}
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          {view.funnel.length >= 2 ? (
            <Funnel
              title={t("insights.audience28.funnel")}
              description={t("insights.audience28.funnelHint")}
              data={view.funnel.map((s) => ({ ...s, label: kindLabel(s.kind) }))}
              label={(step) => step.label}
              value="subjects"
              height={200}
            />
          ) : (
            <p className="text-xs text-fg-muted">{t("insights.audience28.funnelEmpty", { min: view.minAudience })}</p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-bold text-fg">{t("insights.audience28.top")}</h3>
          {view.top.length === 0 ? (
            <p className="mt-2 text-xs text-fg-muted">{t("insights.audience28.topEmpty", { min: view.minAudience })}</p>
          ) : (
            <ol className="mt-2 divide-y divide-border-subtle">
              {view.top.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                  <Link href={`/watch/${v.id}`} className="min-w-0 truncate text-sm font-semibold text-fg hover:underline">
                    {v.title}
                  </Link>
                  <span className="font-mono text-[11px] text-fg-secondary">{t("insights.audience28.topLine", { viewers: v.viewers, views: v.views })}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      {cells.length > 0 && (
        <div className="mt-6">
          <Heatmap
            title={t("insights.audience28.cohorts")}
            description={t("insights.audience28.cohortsHint")}
            data={cells}
            x="week"
            y="cohort"
            value="pct"
            yFormat="day"
            xLabel={t("insights.audience28.weeksAfter")}
            yLabel={t("insights.audience28.firstWeek")}
            height={Math.max(140, 36 * view.cohorts.length)}
          />
        </div>
      )}
    </section>
  );
}
