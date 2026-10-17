import { db, videos } from "@orochia/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { classifyWatch } from "./feed-ranking";
import { feedSettings } from "./feed-settings";
import { enqueueInteraction } from "./recommendations/recommendations.outbox";
import { RecoEventKind } from "./recommendations/recommendations.types";

/**
 * What the vertical feed tells the recommender when a slide leaves the screen: how much of the video was watched and how
 * long it was in view. The server decides what it means (lib/feed-ranking.ts `classifyWatch`, thresholds in the `feed`
 * settings): a skip, a view with its watched share, or nothing. It goes to the recommendation outbox like every other
 * interaction — pseudonymous, at least once, one row per visit (`visit` is the client's id of this look at this slide).
 */
export const WatchEventInput = z.object({
  videoId: z.string().uuid(),
  visit: z.string().uuid(),
  watchedPct: z.number().min(0).max(100),
  dwellMs: z.number().int().min(0).max(24 * 3_600_000),
});
export type WatchEventInput = z.infer<typeof WatchEventInput>;

export async function recordWatch(accountId: string, input: WatchEventInput, now: Date): Promise<"SKIP" | "VIEW" | null> {
  const settings = await feedSettings(now);
  const kind = classifyWatch(input, settings);
  if (!kind) return null;
  const [video] = await db.select({ id: videos.id, creatorId: videos.creatorId }).from(videos).where(eq(videos.id, input.videoId)).limit(1);
  if (!video || video.creatorId === accountId) return null;
  await enqueueInteraction(
    db,
    { accountId, videoId: video.id, creatorId: video.creatorId, kind: kind === "SKIP" ? RecoEventKind.Skip : RecoEventKind.View, watchedPct: Math.round(input.watchedPct), at: now },
    `watch:${input.visit}`,
  );
  return kind;
}
