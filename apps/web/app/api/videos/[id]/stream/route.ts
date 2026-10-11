import { db, videos } from "@orochia/db";
import { BunnyStreamClient } from "@orochia/media";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { evaluateVideoAccess } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { clientIp, playbackIp } from "@/lib/client-ip";
import { recordView } from "@/lib/engagement";
import { bunnyStreamConfig, STREAM_TOKEN_TTL_SECONDS } from "@/lib/env";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Authorises a viewer and returns a short-lived signed HLS URL (AGENTS.md §2.A). */
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
      // Bound to the viewer's address when BUNNY_TOKEN_BIND_IP=on (lib/client-ip.ts).
      playbackIp(req.headers),
    );

    // A view counts once per viewer and day (lib/engagement.ts); counting never blocks playback.
    const network = {
      ip: clientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    };
    recordView(video, user?.id ?? null, network).catch((err: unknown) => console.warn("Failed to record view:", err));

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
