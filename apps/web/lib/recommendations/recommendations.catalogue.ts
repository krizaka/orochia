import { db, recoItemSync, users, videos } from "@orochia/db";
import { and, eq, inArray, sql } from "drizzle-orm";

import { discoverableVideo } from "../explore";
import { documentHash, videoDocument } from "../explorer";
import { sendErasure, sendItems } from "./recommendations.client";
import type { RecoItem, RecommendationSettings } from "./recommendations.types";

/**
 * The recommender's catalogue (ADR-078 §6): Orazaka holds exactly the videos Explore may show (lib/discoverable.ts) —
 * public metadata only. Each round sends the discoverable videos whose text changed (or that Orazaka has not received)
 * and erases the ones that left discovery (taken down, made private, held for review, creator suspended, deleted). The
 * access rules stay Orochia's: Orazaka only ranks what it was given, and every answer is filtered again before display.
 */
export interface CatalogueSummary {
  upserted: number;
  erased: number;
  runId: string | null;
}

/** The item a video becomes — pure. */
export function toRecoItem(video: {
  id: string;
  creatorId: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  durationSeconds: number;
  createdAt: Date;
}): RecoItem {
  return {
    id: video.id,
    creator: video.creatorId,
    title: video.title,
    description: video.description ?? "",
    tags: video.tags ?? [],
    language: null,
    durationSeconds: video.durationSeconds > 0 ? video.durationSeconds : null,
    publishedAt: video.createdAt.toISOString(),
  };
}

export async function syncCatalogue(now: Date, settings: RecommendationSettings): Promise<CatalogueSummary> {
  const rows = await db
    .select({
      id: videos.id,
      creatorId: videos.creatorId,
      title: videos.title,
      description: videos.description,
      tags: videos.tags,
      durationSeconds: videos.durationSeconds,
      createdAt: videos.createdAt,
      syncedHash: recoItemSync.contentHash,
    })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(recoItemSync, eq(recoItemSync.videoId, videos.id))
    .where(discoverableVideo());
  const pending = rows
    .map((row) => {
      const document = videoDocument(row);
      return document ? { row, hash: documentHash(document) } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null && p.hash !== p.row.syncedHash)
    .slice(0, settings.catalogueBatch);

  let runId: string | null = null;
  if (pending.length > 0) {
    const answer = await sendItems(pending.map((p) => toRecoItem(p.row)), settings.syncTimeoutMs);
    runId = answer.data.runId;
    for (const p of pending) {
      await db
        .insert(recoItemSync)
        .values({ videoId: p.row.id, contentHash: p.hash, syncedAt: now })
        .onConflictDoUpdate({ target: recoItemSync.videoId, set: { contentHash: p.hash, syncedAt: now } });
    }
  }

  const discoverable = new Set(rows.map((r) => r.id));
  const synced = await db.select({ videoId: recoItemSync.videoId }).from(recoItemSync);
  const gone = synced.map((s) => s.videoId).filter((id) => !discoverable.has(id)).slice(0, 500);
  if (gone.length > 0) {
    await sendErasure({ users: [], items: gone }, settings.syncTimeoutMs);
    await db.delete(recoItemSync).where(inArray(recoItemSync.videoId, gone));
  }
  return { upserted: pending.length, erased: gone.length, runId };
}

/** How far the catalogue is from Orazaka's: for the operator console. */
export async function catalogueStatus(): Promise<{ discoverable: number; synced: number }> {
  const [d] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .where(and(discoverableVideo()));
  const [s] = await db.select({ n: sql<number>`count(*)::int` }).from(recoItemSync);
  return { discoverable: d?.n ?? 0, synced: s?.n ?? 0 };
}
