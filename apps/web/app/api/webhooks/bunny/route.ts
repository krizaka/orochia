import { NextRequest, NextResponse, after } from "next/server";
import { BunnyStreamClient, exceedsLength, mapBunnyStatusToOrochia, parseBunnyWebhookPayload, verifyBunnyWebhookSignature } from "@orochia/media";
import { db, videos } from "@orochia/db";
import { eq } from "drizzle-orm";
import { bunnyStreamConfig, bunnyWebhookSecret } from "@/lib/env";
import { errorResponse, jsonError } from "@/lib/http";
import { settleStoryVideo } from "@/lib/stories";
import { applyDraftEncoding } from "@/lib/video-drafts";
import { notifyVideoReady } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * Bunny Stream encoding events (https://bunny.net/docs/stream/webhooks), signed v1 with the library's
 * Read-Only API key (BUNNY_WEBHOOK_SECRET). Moves a video to PROCESSING / READY / FAILED; when it is
 * finished, reads its length, renditions and thumbnail from the Stream API (the webhook carries none).
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifyBunnyWebhookSignature({ rawBody, headers: req.headers, signingKey: bunnyWebhookSecret() })) {
      console.warn("bunny webhook: signature refused");
      return jsonError(401, "Invalid signature");
    }

    const payload = parseBunnyWebhookPayload(JSON.parse(rawBody));
    const config = bunnyStreamConfig();
    if (payload.VideoLibraryId !== config.libraryId) {
      console.warn(`bunny webhook: library ${payload.VideoLibraryId} is not ours`);
      return NextResponse.json({ success: true, ignored: "library" });
    }
    const target = mapBunnyStatusToOrochia(payload.Status);
    if (!target) return NextResponse.json({ success: true, ignored: "status" });

    const [video] = await db.select().from(videos).where(eq(videos.bunnyVideoId, payload.VideoGuid)).limit(1);
    if (!video) {
      // Not a video: maybe a story video (stories collection; READY starts its 24 hours, too long is refused).
      const client = new BunnyStreamClient(config);
      let durationSeconds: number | undefined;
      if (target === "READY") {
        durationSeconds = await client
          .getVideo(payload.VideoGuid)
          .then((d) => d.length)
          .catch(() => undefined);
      }
      const story = await settleStoryVideo(payload.VideoGuid, target, client, durationSeconds);
      if (story) return NextResponse.json({ success: true, storyId: story.storyId, status: story.status });
      // Or the original clip of an editor draft.
      const draftId = await applyDraftEncoding(payload.VideoGuid, target, durationSeconds);
      if (draftId) return NextResponse.json({ success: true, draftId, status: target });
      console.warn(`bunny webhook: unknown video ${payload.VideoGuid}`);
      return NextResponse.json({ success: true, ignored: "video" });
    }
    // Events can arrive late or out of order: a READY video never goes back to PROCESSING.
    if (video.status === "READY" && target === "PROCESSING") return NextResponse.json({ success: true, status: video.status });

    const update: Partial<typeof videos.$inferInsert> = { status: target, updatedAt: new Date() };
    if (target === "READY") {
      const base = `https://${config.hostname}/${payload.VideoGuid}`;
      update.thumbnailUrl = `${base}/thumbnail.jpg`;
      update.previewAnimationUrl = `${base}/preview.webp`;
      try {
        const details = await new BunnyStreamClient(config).getVideo(payload.VideoGuid);
        update.durationSeconds = Math.round(details.length || 0);
        if (exceedsLength("video", details.length || 0)) {
          // Above the upload limit (a client bypassed the browser check): refused and deleted at Bunny.
          await new BunnyStreamClient(config).deleteVideo(payload.VideoGuid).catch(() => undefined);
          await db.update(videos).set({ status: "FAILED", updatedAt: new Date() }).where(eq(videos.id, video.id));
          return NextResponse.json({ success: true, videoId: video.id, status: "FAILED", reason: "too long" });
        }
        update.resolutions = details.availableResolutions ? details.availableResolutions.split(",").filter(Boolean) : video.resolutions;
        if (details.thumbnailFileName) update.thumbnailUrl = `${base}/${details.thumbnailFileName}`;
      } catch (error) {
        // The video is playable either way; its length and renditions are filled on the next event.
        console.error("bunny webhook: could not read the video details", error);
      }
    }
    await db.update(videos).set(update).where(eq(videos.id, video.id));
    // Online for the first time: the creator (and their followers) hear about it.
    if (target === "READY" && video.status !== "READY") after(() => notifyVideoReady(video.id));
    return NextResponse.json({ success: true, videoId: video.id, status: target });
  } catch (error) {
    return errorResponse(error, "webhooks/bunny");
  }
}
