import { db, videos } from "@orochia/db";
import { BunnyApiError, BunnyStreamClient, exceedsLength, mapBunnyApiStatusToOrochia } from "@orochia/media";
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { bunnyStreamConfig } from "./env";
import { notifyVideoReady } from "./notifications";
import { holdReason } from "./storage-usage";

/** A video id Bunny issued (a UUID); seed placeholders such as `qa-explorer-03` hold no media at all. */
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isBunnyGuid = (id: string | null | undefined): boolean => Boolean(id && GUID.test(id));

/** A video unsettled, or online without its poster, is worth asking Bunny about. */
export function needsReconcile(video: { status: string; thumbnailUrl: string | null; bunnyVideoId: string | null }): boolean {
  if (!isBunnyGuid(video.bunnyVideoId)) return false;
  if (video.status === "PENDING_UPLOAD" || video.status === "PROCESSING") return true;
  return video.status === "READY" && !video.thumbnailUrl;
}

/** What the webhook writes on READY, from the Stream API's answer (shared so both paths agree). */
export function videoMediaFromBunny(
  details: { length?: number; storageSize?: number; availableResolutions?: string; thumbnailFileName?: string },
  hostname: string,
  guid: string,
) {
  const base = `https://${hostname}/${guid}`;
  return {
    thumbnailUrl: `${base}/${details.thumbnailFileName || "thumbnail.jpg"}`,
    previewAnimationUrl: `${base}/preview.webp`,
    durationSeconds: Math.round(details.length || 0),
    storageBytes: Math.max(0, Math.round(details.storageSize || 0)),
    resolutions: details.availableResolutions ? details.availableResolutions.split(",").filter(Boolean) : [],
  };
}

/** A video is asked about at most once per this window. */
export const VIDEO_RECHECK_AFTER_MS = 20_000;

/**
 * Catch-up for a lost Bunny webhook (dev shares one library across environments; a delivery can be lost anywhere):
 * asks the Stream API about videos still unsettled, or READY without a poster, and applies the answer as the webhook
 * would — poster, preview, length, renditions, READY/FAILED, the quota hold and the "your video is online" notice.
 * Each video is claimed (its updated_at moved) before the call. Never throws.
 */
export async function reconcileVideos(options: { creatorId?: string; limit?: number; client?: Pick<BunnyStreamClient, "getVideo" | "deleteVideo"> } = {}) {
  if (!process.env.MEDIA_STREAM_API_KEY?.trim()) return { checked: 0, settled: 0 };
  const stale = new Date(Date.now() - VIDEO_RECHECK_AFTER_MS);
  const candidates = await db
    .select({ id: videos.id, bunnyVideoId: videos.bunnyVideoId, status: videos.status, thumbnailUrl: videos.thumbnailUrl, creatorId: videos.creatorId })
    .from(videos)
    .where(
      and(
        or(inArray(videos.status, ["PENDING_UPLOAD", "PROCESSING"]), and(eq(videos.status, "READY"), isNull(videos.thumbnailUrl))),
        sql`${videos.bunnyVideoId} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`,
        isNull(videos.removedAt),
        lt(videos.updatedAt, stale),
        options.creatorId ? eq(videos.creatorId, options.creatorId) : undefined,
      ),
    )
    .orderBy(asc(videos.updatedAt))
    .limit(options.limit ?? 10);
  if (candidates.length === 0) return { checked: 0, settled: 0 };
  const config = bunnyStreamConfig();
  const client = options.client ?? new BunnyStreamClient(config);

  const results = await Promise.all(
    candidates.map(async (video) => {
      const guid = video.bunnyVideoId!;
      try {
        const [claimed] = await db
          .update(videos)
          .set({ updatedAt: new Date() })
          .where(and(eq(videos.id, video.id), lt(videos.updatedAt, stale)))
          .returning({ id: videos.id });
        if (!claimed) return false;
        const details = await client.getVideo(guid).catch((error: unknown) => {
          if (error instanceof BunnyApiError && error.status === 404) return null;
          throw error;
        });
        if (!details) {
          if (video.status !== "READY") await db.update(videos).set({ status: "FAILED", updatedAt: new Date() }).where(eq(videos.id, video.id));
          return false;
        }
        const target = mapBunnyApiStatusToOrochia(details.status);
        if (!target) return false;
        if (target === "FAILED") {
          if (video.status !== "READY") await db.update(videos).set({ status: "FAILED", updatedAt: new Date() }).where(eq(videos.id, video.id));
          return false;
        }
        if (target === "PROCESSING") {
          if (video.status === "PENDING_UPLOAD") await db.update(videos).set({ status: "PROCESSING", updatedAt: new Date() }).where(eq(videos.id, video.id));
          return false;
        }
        if (exceedsLength("video", details.length || 0)) {
          await client.deleteVideo(guid).catch(() => undefined);
          await db.update(videos).set({ status: "FAILED", storageBytes: 0, updatedAt: new Date() }).where(eq(videos.id, video.id));
          return false;
        }
        await db.update(videos).set({ ...videoMediaFromBunny(details, config.hostname, guid), updatedAt: new Date() }).where(eq(videos.id, video.id));
        if (video.status !== "READY") {
          const held = await holdReason(video.creatorId);
          if (held) {
            await db.update(videos).set({ status: "HELD", updatedAt: new Date() }).where(eq(videos.id, video.id));
          } else {
            await db.update(videos).set({ status: "READY", updatedAt: new Date() }).where(eq(videos.id, video.id));
            await notifyVideoReady(video.id).catch(() => undefined);
          }
        }
        console.info(`videos: ${video.id} reconciled with Bunny (webhook missing)`);
        return true;
      } catch (error) {
        console.warn(`videos: could not reconcile ${video.id} with Bunny`, error instanceof Error ? error.message : error);
        return false;
      }
    }),
  );
  return { checked: candidates.length, settled: results.filter(Boolean).length };
}
