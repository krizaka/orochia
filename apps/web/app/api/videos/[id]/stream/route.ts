import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { evaluateVideoAccess } from "@/lib/access";
import { BunnyStreamClient } from "@orochia/media";
import { db, videos } from "@orochia/db";
import { eq, sql } from "drizzle-orm";
import { bunnyStreamConfig, STREAM_TOKEN_TTL_SECONDS } from "@/lib/env";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Authorises a viewer and returns a short-lived signed HLS URL (AGENTS.md §2.A). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = z.string().uuid().safeParse(params.id);
    if (!id.success) return jsonError(404, "Video not found");
    const user = await getCurrentUser();

    const access = await evaluateVideoAccess(id.data, user?.id);
    if (!access.allowed) {
      return NextResponse.json(
        { allowed: false, reason: access.reason, minTipAmountCents: access.minTipAmountCents, videoTitle: access.videoTitle },
        { status: access.reason === "NOT_FOUND" ? 404 : 403 },
      );
    }

    const [video] = await db.select().from(videos).where(eq(videos.id, id.data)).limit(1);
    if (!video || video.status !== "READY") return jsonError(409, "Video is not ready yet");

    const signed = new BunnyStreamClient(bunnyStreamConfig()).getSignedStreamUrl(
      video.bunnyVideoId,
      STREAM_TOKEN_TTL_SECONDS,
    );

    db.update(videos)
      .set({ viewsCount: sql`${videos.viewsCount} + 1` })
      .where(eq(videos.id, video.id))
      .catch((err: unknown) => console.warn("Failed to increment views:", err));

    return NextResponse.json({
      allowed: true,
      videoId: video.id,
      title: video.title,
      streamUrl: signed.directM3u8Url,
      expires: signed.expires,
    });
  } catch (error) {
    return errorResponse(error, "videos/stream");
  }
}
