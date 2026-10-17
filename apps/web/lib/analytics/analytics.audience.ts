import { db, videos } from "@orochia/db";
import { addDays, format } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";

import { OrazakaUnavailableError } from "../orazaka";
import { recommendationSettings } from "../recommendations/recommendations.settings";
import { fetchAnalyticsFunnel, fetchAnalyticsInsights } from "./analytics.client";
import { AudienceStatus, type AudienceView, describeAudience } from "./analytics.view";

/**
 * A creator's audience over the last `audienceDays` (ADR-081): KPIs against the period before, the days, the videos
 * most people engaged, the view → like → tip funnel and the weekly cohorts — computed by Orazaka from the events
 * Orochia already sends, narrowed to this creator's videos. Same switch as the recommendations (`off`), `unavailable`
 * when Orazaka does not answer.
 */
export async function creatorAudience(creatorId: string, now: Date): Promise<AudienceView> {
  const settings = await recommendationSettings(now);
  if (!settings?.enabled) return { status: AudienceStatus.Off };
  const to = format(addDays(now, 1), "yyyy-MM-dd");
  const from = format(addDays(now, 1 - settings.audienceDays), "yyyy-MM-dd");
  try {
    const [insights, funnel] = await Promise.all([
      fetchAnalyticsInsights(creatorId, from, to, settings.timeoutMs),
      fetchAnalyticsFunnel(creatorId, settings.audienceFunnel, from, to, settings.timeoutMs),
    ]);
    const ids = insights.data.topItems.map((i) => i.itemId);
    const own = ids.length
      ? await db.select({ id: videos.id, title: videos.title }).from(videos).where(and(eq(videos.creatorId, creatorId), inArray(videos.id, ids)))
      : [];
    return describeAudience(insights.data, funnel.data, new Map(own.map((v) => [v.id, v.title])));
  } catch (error) {
    if (error instanceof OrazakaUnavailableError) return { status: AudienceStatus.Unavailable };
    throw error;
  }
}
