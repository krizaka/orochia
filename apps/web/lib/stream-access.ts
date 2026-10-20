import { db, videos } from "@orochia/db";
import { BunnyStreamClient } from "@orochia/media";
import { eq } from "drizzle-orm";

import { evaluateVideoAccess } from "@/lib/access";
import { clientIp, playbackIp } from "@/lib/client-ip";
import { recordView } from "@/lib/engagement";
import { bunnyStreamConfig, STREAM_TOKEN_TTL_SECONDS } from "@/lib/env";

const NOT_FOUND = "NOT_FOUND";
const READY = "READY";

/** What a viewer may do with a video: a short-lived signed HLS URL, or the reason there is none. */
export interface StreamAccess {
  allowed: boolean;
  streamUrl?: string;
  expires?: number;
  reason?: string;
  code?: string;
  minTipAmountCents?: number;
  videoTitle?: string;
}

/**
 * The access decision and the signed HLS URL (AGENTS.md §2.A), shared by `/api/videos/:id/stream` (a re-check after a
 * tip, a follow, a won auction) and the watch page itself, which signs on the server so the player has its URL in the
 * first HTML: no client round-trip before the first frame. `status` is the HTTP status the API answers with.
 */
export async function resolveStreamAccess(
  videoId: string,
  user: { id: string } | null | undefined,
  headers: Headers,
): Promise<{ status: number; body: StreamAccess; video?: typeof videos.$inferSelect }> {
  const access = await evaluateVideoAccess(videoId, user?.id);
  if (!access.allowed) {
    return {
      status: access.reason === NOT_FOUND ? 404 : 403,
      body: { allowed: false, reason: access.reason, code: access.code, minTipAmountCents: access.minTipAmountCents, videoTitle: access.videoTitle },
    };
  }
  const [video] = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
  if (!video || video.status !== READY) return { status: 409, body: { allowed: false, reason: "NOT_READY" } };

  const config = bunnyStreamConfig();
  const signed = new BunnyStreamClient(config).getSignedStreamUrl(
    video.bunnyVideoId,
    STREAM_TOKEN_TTL_SECONDS,
    // Bound to the viewer's address when MEDIA_STREAM_TOKEN_BIND_IP=on (lib/client-ip.ts).
    playbackIp(headers),
  );
  // A view counts once per viewer and day (lib/engagement.ts); counting never blocks playback.
  recordView(video, user?.id ?? null, { ip: clientIp(headers), userAgent: headers.get("user-agent") }).catch((err: unknown) => console.warn("Failed to record view:", err));
  return { status: 200, video, body: { allowed: true, streamUrl: signed.directM3u8Url, expires: signed.expires } };
}
