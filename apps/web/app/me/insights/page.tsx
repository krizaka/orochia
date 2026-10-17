import { BarChart3, Clock, Hash, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import React from "react";

import { AudienceSection } from "@/components/insights/AudienceSection";
import { buttonVariants, EmptyState, SectionBackdrop } from "@/components/ui";
import { creatorAudience } from "@/lib/analytics/analytics.audience";
import { t } from "@/lib/i18n";
import { creatorInsights } from "@/lib/recommendations/recommendations.insights";
import { recommendationSettings } from "@/lib/recommendations/recommendations.settings";
import { InsightsStatus } from "@/lib/recommendations/recommendations.view";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export const metadata = { title: t("insights.metaTitle"), robots: { index: false } };

const card = "rounded-3xl border border-border-default bg-surface-1/60 p-5 shadow-xs";

function Block({ icon: Icon, title, hint, children }: { icon: React.ElementType; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className={card} aria-label={title}>
      <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
        <Icon className="h-4 w-4 text-fg-accent" aria-hidden /> {title}
      </h2>
      <p className="mt-1 text-[11px] text-fg-muted">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * A creator's insights (v1): how each video engages its viewers, which tags work, when the audience is around, and how
 * many other creators it also follows — from the interactions Orochia's recommender received (pseudonymous, counts only).
 */
export default async function InsightsPage() {
  const { user, state } = await getViewer();
  if (!user) redirect("/auth/login?next=/me/insights");
  if (state !== "creator") redirect("/me");
  const now = new Date();
  const [view, audience, settings] = await Promise.all([creatorInsights(user.id, now), creatorAudience(user.id, now), recommendationSettings(now)]);

  return (
    <div className="pb-16">
      <SectionBackdrop as="header" className="px-4 pb-6 pt-10 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="font-display text-3xl font-black tracking-tight text-fg sm:text-4xl">{t("insights.title")}</h1>
          <p className="mt-2 max-w-xl text-sm text-fg-secondary">{t("insights.subtitle")}</p>
        </div>
      </SectionBackdrop>
      <div className="mx-auto mt-6 grid max-w-5xl gap-4 px-4 sm:px-6">
        {view.status !== InsightsStatus.Ok ? (
          <EmptyState
            bird="owl"
            title={view.status === InsightsStatus.Off ? t("insights.offTitle") : t("insights.unavailableTitle")}
            description={view.status === InsightsStatus.Off ? t("insights.offBody") : t("insights.unavailableBody")}
            action={<Link href="/me/earnings" className={buttonVariants({ variant: "secondary", size: "sm" })}>{t("insights.toEarnings")}</Link>}
          />
        ) : (
          <>
            <AudienceSection view={audience} days={settings?.audienceDays ?? 28} />
            <Block icon={BarChart3} title={t("insights.videos.title")} hint={t("insights.videos.hint")}>
              {view.videos.length === 0 ? (
                <p className="text-xs text-fg-muted">{t("insights.videos.empty")}</p>
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {view.videos.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <Link href={`/watch/${v.id}`} className="min-w-0 truncate text-sm font-semibold text-fg hover:underline">{v.title}</Link>
                      <span className="font-mono text-[11px] text-fg-secondary">
                        {t("insights.videos.line", { views: v.views, engagements: v.engagements, rate: v.ratePct })}
                        {v.avgWatchedPct !== null && ` · ${t("insights.videos.watched", { pct: Math.round(v.avgWatchedPct) })}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
            <div className="grid gap-4 sm:grid-cols-2">
              <Block icon={Hash} title={t("insights.tags.title")} hint={t("insights.tags.hint")}>
                {view.tags.length === 0 ? (
                  <p className="text-xs text-fg-muted">{t("insights.tags.empty")}</p>
                ) : (
                  <ul className="grid gap-1.5">
                    {view.tags.map((tag) => (
                      <li key={tag.tag} className="flex justify-between text-sm text-fg">
                        <span>#{tag.tag}</span>
                        <span className="font-mono text-[11px] text-fg-secondary">{t("insights.tags.line", { videos: tag.videos, rate: tag.ratePct })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>
              <Block icon={Clock} title={t("insights.hours.title")} hint={t("insights.hours.hint", { min: view.minAudience })}>
                {view.bestHours.length === 0 ? (
                  <p className="text-xs text-fg-muted">{t("insights.hours.empty")}</p>
                ) : (
                  <ul className="grid gap-1.5">
                    {view.bestHours.map((h) => (
                      <li key={`${h.isoDayOfWeek}-${h.hour}`} className="flex justify-between text-sm text-fg">
                        <span>{t("insights.hours.slot", { day: t("insights.weekdays").split(" ")[h.isoDayOfWeek - 1] ?? "", hour: String(h.hour).padStart(2, "0") })}</span>
                        <span className="font-mono text-[11px] text-fg-secondary">{h.engagements}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>
            </div>
            <Block icon={Users} title={t("insights.audience.title")} hint={t("insights.audience.hint", { min: view.minAudience })}>
              <p className="text-sm text-fg">{t("insights.audience.line", { count: view.alsoWatchedCount })}</p>
            </Block>
          </>
        )}
      </div>
    </div>
  );
}
