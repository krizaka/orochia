import type { Insights } from "./recommendations.types";

/** Whether insights could be drawn. */
export const InsightsStatus = { Ok: "ok", Off: "off", Unavailable: "unavailable" } as const;
export type InsightsStatus = (typeof InsightsStatus)[keyof typeof InsightsStatus];

/** Creator insights as the page draws them — pure, so every rule is a unit test. */
export type InsightsView =
  | { status: typeof InsightsStatus.Off | typeof InsightsStatus.Unavailable }
  | {
      status: typeof InsightsStatus.Ok;
      requestId: string | null;
      videos: { id: string; title: string; views: number; engagements: number; ratePct: number; avgWatchedPct: number | null }[];
      tags: { tag: string; videos: number; views: number; ratePct: number }[];
      bestHours: { isoDayOfWeek: number; hour: number; engagements: number }[];
      alsoWatchedCount: number;
      minAudience: number;
    };

/**
 * Keeps only the creator's own videos that still exist (a title Orochia knows), turns rates into percentages, and keeps
 * creators the audience also watches as a count only — a creator never learns another creator's audience by name.
 */
export function describeInsights(data: Insights, titles: Map<string, string>, requestId: string | null): InsightsView {
  return {
    status: InsightsStatus.Ok,
    requestId,
    videos: data.items
      .filter((i) => titles.has(i.itemId))
      .map((i) => ({ id: i.itemId, title: titles.get(i.itemId) ?? "", views: i.views, engagements: i.engagements, ratePct: Math.round(i.engagementRate * 100), avgWatchedPct: i.avgWatchedPct })),
    tags: data.tags.map((t) => ({ tag: t.tag, videos: t.items, views: t.views, ratePct: Math.round(t.engagementRate * 100) })),
    bestHours: data.bestHours,
    alsoWatchedCount: data.alsoWatched.length,
    minAudience: data.minAudience,
  };
}
