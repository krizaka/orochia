import { db, videos } from "@orochia/db";
import { BunnyStreamClient, exceedsLength, mapBunnyStatusToOrochia, parseBunnyWebhookPayload, verifyBunnyWebhookSignature } from "@orochia/media";
import { eq } from "drizzle-orm";
import { after,NextRequest, NextResponse } from "next/server";

import { bunnyStreamConfig, bunnyWebhookSecret } from "@/lib/env";
import { errorResponse, jsonError } from "@/lib/http";
import { notify, notifyVideoReady } from "@/lib/notifications";
import { checkPlatformAlerts,holdReason, recordStoredBytes, warnCreatorIfLow } from "@/lib/storage-usage";
import { settleStoryVideo } from "@/lib/stories";
import { applyDraftEncoding } from "@/lib/video-drafts";

export const dynamic = "force-dynamic";

/**
 * Bunny Stream encoding events (https://bunny.net/docs/stream/webhooks), signed v1 with the library's
 * Read-Only API key (MEDIA_STREAM_WEBHOOK_SECRET). Moves a video to PROCESSING / READY / FAILED; when it is
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
      let storageBytes: number | undefined;
      if (target === "READY") {
        const details = await client.getVideo(payload.VideoGuid).catch(() => undefined);
        durationSeconds = details?.length;
        storageBytes = details?.storageSize;
      }
      const story = await settleStoryVideo(payload.VideoGuid, target, client, durationSeconds, storageBytes);
      if (story) return NextResponse.json({ success: true, storyId: story.storyId, status: story.status });
      // Or the original clip of an editor draft (its real size counts against the plan from now on).
      if (storageBytes !== undefined) await recordStoredBytes(payload.VideoGuid, storageBytes);
      const draftId = await applyDraftEncoding(payload.VideoGuid, target, durationSeconds);
      if (draftId) return NextResponse.json({ success: true, draftId, status: target });
      console.warn(`bunny webhook: unknown video ${payload.VideoGuid}`);
      return NextResponse.json({ success: true, ignored: "video" });
    }
    // Events can arrive late or out of order: a READY (or held) video never goes back to PROCESSING.
    if ((video.status === "READY" || video.status === "HELD") && target === "PROCESSING") return NextResponse.json({ success: true, status: video.status });

    // A held video stays held on a repeated READY: only freed space (releaseHeld) puts it online.
    const update: Partial<typeof videos.$inferInsert> = { status: video.status === "HELD" && target === "READY" ? "HELD" : target, updatedAt: new Date() };
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
          await db.update(videos).set({ status: "FAILED", storageBytes: 0, updatedAt: new Date() }).where(eq(videos.id, video.id));
          return NextResponse.json({ success: true, videoId: video.id, status: "FAILED", reason: "too long" });
        }
        // The real size (renditions included) replaces the declared one. Tus does not stop a client sending more
        // bytes than it declared: past the creator's plan or the platform's cap the video is HELD — kept, private,
        // released when space is freed (lib/storage-usage.ts) — never deleted for it.
        update.storageBytes = Math.max(0, Math.round(details.storageSize || 0));
        update.resolutions = details.availableResolutions ? details.availableResolutions.split(",").filter(Boolean) : video.resolutions;
        if (details.thumbnailFileName) update.thumbnailUrl = `${base}/${details.thumbnailFileName}`;
        if (details.width > 0 && details.height > 0) {
          update.width = Math.round(details.width);
          update.height = Math.round(details.height);
        }
        if (details.framerate > 0) update.framerate = details.framerate;
      } catch (error) {
        // The video is playable either way; its length and renditions are filled on the next event.
        console.error("bunny webhook: could not read the video details", error);
      }
    }
    await db.update(videos).set(update).where(eq(videos.id, video.id));
    if (target === "READY" && video.status !== "READY" && video.status !== "HELD") {
      const held = await holdReason(video.creatorId);
      if (held) {
        await db.update(videos).set({ status: "HELD", updatedAt: new Date() }).where(eq(videos.id, video.id));
        console.warn(`quota: video ${video.id} held after encoding (${held} limit)`);
        after(async () => {
          await notify({ userId: video.creatorId, event: "storageHeld", vars: { title: video.title }, path: "/dashboard?tab=uploads" });
          await checkPlatformAlerts();
        });
        return NextResponse.json({ success: true, videoId: video.id, status: "HELD", reason: held });
      }
      // Online for the first time: the creator (and their followers) hear about it.
      after(async () => {
        await notifyVideoReady(video.id);
        await warnCreatorIfLow(video.creatorId);
        await checkPlatformAlerts();
      });
    }
    return NextResponse.json({ success: true, videoId: video.id, status: target });
  } catch (error) {
    return errorResponse(error, "webhooks/bunny");
  }
}
