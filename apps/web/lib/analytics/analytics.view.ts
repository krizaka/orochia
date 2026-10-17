import { randomUUID } from "node:crypto";

import { pseudonymOf } from "../recommendations/recommendations.pseudonym";
import type { AnalyticsEvent, AnalyticsFunnel, AnalyticsInsights, AnalyticsKind } from "./analytics.types";

/** Whether the audience could be drawn. */
export const AudienceStatus = { Ok: "ok", TooSmall: "too_small", Off: "off", Unavailable: "unavailable" } as const;
export type AudienceStatus = (typeof AudienceStatus)[keyof typeof AudienceStatus];

export type Trend = "up" | "down" | "flat";

/** The tiles of the audience section, in their order on the page. */
export const AudienceTile = { Viewers: "viewers", Views: "views", Likes: "likes", Tips: "tips", Watched: "watched" } as const;
export type AudienceTile = (typeof AudienceTile)[keyof typeof AudienceTile];

export type AudienceView =
  | { status: typeof AudienceStatus.Off | typeof AudienceStatus.Unavailable }
  | { status: typeof AudienceStatus.TooSmall; minAudience: number }
  | {
      status: typeof AudienceStatus.Ok;
      minAudience: number;
      /** `value` null: under the audience threshold — said as such, never as 0. */
      tiles: { key: AudienceTile; value: number | null; changePct: number | null; trend: Trend }[];
      series: { day: string; viewers: number | null; views: number | null; likes: number | null }[];
      top: { id: string; title: string; viewers: number; views: number }[];
      funnel: { kind: string; subjects: number }[];
      cohorts: { week: string; size: number; retentionPct: number[] }[];
    };

function trendOf(change: number | null): Trend {
  if (change === null || change === 0) return "flat";
  return change > 0 ? "up" : "down";
}

/**
 * The creator's audience over the range — pure, so every rule is a unit test. Figures under the audience threshold stay
 * hidden (Orazaka never sends them); a top video is shown only when it is still the creator's (a title Orochia knows).
 */
export function describeAudience(insights: AnalyticsInsights, funnel: AnalyticsFunnel, titles: Map<string, string>): AudienceView {
  if (insights.suppressed || !insights.activeSubjects) return { status: AudienceStatus.TooSmall, minAudience: insights.minAudience };
  const kind = (name: string) => insights.kinds.find((k) => k.kind === name);
  const count = (name: string) => {
    const k = kind(name);
    return { value: k ? k.count.current : null, change: k?.count.change ?? null };
  };
  const tile = (key: AudienceTile, value: number | null, change: number | null) => ({
    key,
    value,
    changePct: change === null ? null : Math.round(change * 100),
    trend: trendOf(change),
  });
  const watched = kind("watch")?.valueMean ?? null;
  return {
    status: AudienceStatus.Ok,
    minAudience: insights.minAudience,
    tiles: [
      tile(AudienceTile.Viewers, insights.activeSubjects.current, insights.activeSubjects.change),
      tile(AudienceTile.Views, count("view").value, count("view").change),
      tile(AudienceTile.Likes, count("like").value, count("like").change),
      tile(AudienceTile.Tips, count("tip").value, count("tip").change),
      tile(AudienceTile.Watched, watched === null ? null : Math.round(watched), null),
    ],
    series: insights.series.map((d) =>
      d.suppressed
        ? { day: d.day, viewers: null, views: null, likes: null }
        : { day: d.day, viewers: d.activeSubjects, views: d.events.view ?? 0, likes: d.events.like ?? 0 },
    ),
    top: insights.topItems
      .filter((i) => titles.has(i.itemId))
      .map((i) => ({ id: i.itemId, title: titles.get(i.itemId) ?? "", viewers: i.subjects, views: i.views })),
    funnel: funnel.steps.filter((s) => !s.suppressed && s.subjects !== null).map((s) => ({ kind: s.kind, subjects: s.subjects ?? 0 })),
    cohorts: insights.cohorts.map((c) => ({ week: c.week, size: c.size, retentionPct: c.retention.map((r) => Math.round(r * 100)) })),
  };
}

/** What leaving a video says: the share watched, and whether it was a skip (left at once). Null when nothing played. */
export function watchOutcome(
  played: { watchedSeconds: number; durationSeconds: number },
  rule: { skipWithinSeconds: number; skipBelowPct: number },
): { watchedPct: number; skip: boolean } | null {
  if (!(played.durationSeconds > 0) || !(played.watchedSeconds > 0)) return null;
  const watchedPct = Math.min(100, Math.round((played.watchedSeconds / played.durationSeconds) * 100));
  return { watchedPct, skip: played.watchedSeconds <= rule.skipWithinSeconds && watchedPct < rule.skipBelowPct };
}

export interface ProductEvent {
  accountId: string;
  videoId?: string | null;
  creatorId?: string | null;
  kind: AnalyticsKind;
  value?: number | null;
  at: Date;
}

/** An analytics event as it leaves — only the pseudonym, the public ids, the kind, its value, when. */
export function toAnalyticsEvent(event: ProductEvent, key: string, id: string = randomUUID()): AnalyticsEvent {
  return {
    id,
    subject: pseudonymOf(event.accountId, key),
    kind: event.kind,
    item: event.videoId ?? null,
    owner: event.creatorId ?? null,
    value: event.value ?? null,
    at: event.at.toISOString(),
  };
}
