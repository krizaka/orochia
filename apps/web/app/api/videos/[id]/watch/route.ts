import { db, videos } from "@orochia/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { evaluateVideoAccess } from "@/lib/access";
import { AnalyticsKind } from "@/lib/analytics/analytics.types";
import { watchOutcome } from "@/lib/analytics/analytics.view";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enqueueAnalytics, enqueueInteraction } from "@/lib/recommendations/recommendations.outbox";
import { recommendationSettings } from "@/lib/recommendations/recommendations.settings";
import { RecoEventKind } from "@/lib/recommendations/recommendations.types";

export const dynamic = "force-dynamic";

const WatchSchema = z.object({
  watchedSeconds: z.number().nonnegative().max(86_400),
  durationSeconds: z.number().nonnegative().max(86_400),
});

/**
 * The player says how much of a video a signed-in viewer watched when they left it (ADR-081): the share watched goes to
 * Orazaka's analytics (`watch`), and leaving at once is a `SKIP` for the recommender. Sent once per play by
 * `navigator.sendBeacon`; a guest, the creator's own plays and a video the viewer may not watch record nothing.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const body = WatchSchema.safeParse(await req.json().catch(() => null));
    if (!body.success) return jsonError(400, "Invalid watch report");
    const user = await getCurrentUser();
    if (!user) return new NextResponse(null, { status: 204 });
    await enforceRateLimit(`watch:${user.id}`, 120, 60 * 60);

    const [video] = await db.select({ id: videos.id, creatorId: videos.creatorId }).from(videos).where(eq(videos.id, id.data)).limit(1);
    if (!video || video.creatorId === user.id) return new NextResponse(null, { status: 204 });
    const access = await evaluateVideoAccess(video.id, user.id);
    if (!access.allowed) return new NextResponse(null, { status: 204 });

    const settings = await recommendationSettings(new Date());
    if (!settings) return new NextResponse(null, { status: 204 });
    const outcome = watchOutcome(body.data, settings);
    if (!outcome) return new NextResponse(null, { status: 204 });
    const at = new Date();
    await db.transaction(async (tx) => {
      await enqueueAnalytics(tx, { accountId: user.id, videoId: video.id, creatorId: video.creatorId, kind: AnalyticsKind.Watch, value: outcome.watchedPct, at });
      if (outcome.skip) await enqueueInteraction(tx, { accountId: user.id, videoId: video.id, creatorId: video.creatorId, kind: RecoEventKind.Skip, at });
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error, "Failed to record the watch");
  }
}
