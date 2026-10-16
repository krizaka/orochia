import { db, videos } from "@orochia/db";
import { and, eq, inArray } from "drizzle-orm";

import { OrazakaUnavailableError } from "../orazaka";
import { fetchInsights } from "./recommendations.client";
import { recommendationSettings } from "./recommendations.settings";
import { describeInsights, InsightsStatus, type InsightsView } from "./recommendations.view";

/**
 * Creator analytics v1 (ADR-078 §7): what the recommender knows about a creator's audience — per video, per tag, the
 * best hours, who else they watch — with the titles of the creator's own videos put back by Orochia (Orazaka never
 * stores a title). `off` when the feature is switched off, `unavailable` when Orazaka does not answer.
 */
export async function creatorInsights(creatorId: string, now: Date): Promise<InsightsView> {
  const settings = await recommendationSettings(now);
  if (!settings?.enabled) return { status: InsightsStatus.Off };
  try {
    const { data, requestId } = await fetchInsights(creatorId, settings.timeoutMs);
    const ids = data.items.map((i) => i.itemId);
    const own = ids.length
      ? await db.select({ id: videos.id, title: videos.title }).from(videos).where(and(eq(videos.creatorId, creatorId), inArray(videos.id, ids)))
      : [];
    return describeInsights(data, new Map(own.map((v) => [v.id, v.title])), requestId);
  } catch (error) {
    if (error instanceof OrazakaUnavailableError) return { status: InsightsStatus.Unavailable };
    throw error;
  }
}
