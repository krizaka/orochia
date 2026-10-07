import { db, playlists, playlistItems, videos, users, profiles } from "@orochia/db";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { HttpError } from "./http";
import type { VideoSummary } from "./queries";

/**
 * Playlists: any account curates them; public ones appear on the owner's page. Items are video
 * summaries only — a playlist never grants access, each play still goes through lib/access.ts.
 */

export interface PlaylistCard {
  id: string;
  title: string;
  description: string | null;
  isPrivate: boolean;
  itemsCount: number;
  coverUrl: string | null;
  updatedAt: Date;
}

const card = {
  id: playlists.id,
  title: playlists.title,
  description: playlists.description,
  isPrivate: playlists.isPrivate,
  updatedAt: playlists.updatedAt,
  itemsCount: sql<number>`(select count(*)::int from ${playlistItems} pi join ${videos} v on v.id = pi.video_id where pi.playlist_id = playlists.id and v.removed_at is null)`,
  coverUrl: sql<string | null>`(select v.thumbnail_url from ${playlistItems} pi join ${videos} v on v.id = pi.video_id where pi.playlist_id = playlists.id and v.removed_at is null order by pi.position limit 1)`,
};

export async function myPlaylists(ownerId: string): Promise<PlaylistCard[]> {
  return db.select(card).from(playlists).where(eq(playlists.creatorId, ownerId)).orderBy(desc(playlists.updatedAt));
}

export async function publicPlaylists(ownerId: string): Promise<PlaylistCard[]> {
  return db
    .select(card)
    .from(playlists)
    .where(and(eq(playlists.creatorId, ownerId), eq(playlists.isPrivate, false)))
    .orderBy(desc(playlists.updatedAt));
}

export async function createPlaylist(ownerId: string, input: { title: string; description?: string | null; isPrivate?: boolean }) {
  const [row] = await db
    .insert(playlists)
    .values({ creatorId: ownerId, title: input.title, description: input.description ?? null, isPrivate: input.isPrivate ?? false })
    .returning({ id: playlists.id });
  return row;
}

async function owned(ownerId: string, playlistId: string) {
  const [row] = await db.select().from(playlists).where(eq(playlists.id, playlistId)).limit(1);
  if (!row || row.creatorId !== ownerId) throw new HttpError(404, "Playlist not found");
  return row;
}

export async function updatePlaylist(ownerId: string, playlistId: string, patch: { title?: string; description?: string | null; isPrivate?: boolean }) {
  await owned(ownerId, playlistId);
  await db.update(playlists).set({ ...patch, updatedAt: new Date() }).where(eq(playlists.id, playlistId));
}

export async function deletePlaylist(ownerId: string, playlistId: string) {
  await owned(ownerId, playlistId);
  await db.delete(playlists).where(eq(playlists.id, playlistId));
}

/** Appends a video (idempotent). Only videos anyone can see listed can be added. */
export async function addToPlaylist(ownerId: string, playlistId: string, videoId: string) {
  await owned(ownerId, playlistId);
  const [video] = await db
    .select({ id: videos.id })
    .from(videos)
    .where(and(eq(videos.id, videoId), eq(videos.status, "READY"), isNull(videos.removedAt)))
    .limit(1);
  if (!video) throw new HttpError(404, "Video not found");
  await db.transaction(async (tx) => {
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${playlistItems.position}), -1)::int + 1` })
      .from(playlistItems)
      .where(eq(playlistItems.playlistId, playlistId));
    await tx.insert(playlistItems).values({ playlistId, videoId, position: next }).onConflictDoNothing();
    await tx.update(playlists).set({ updatedAt: new Date() }).where(eq(playlists.id, playlistId));
  });
}

export async function removeFromPlaylist(ownerId: string, playlistId: string, videoId: string) {
  await owned(ownerId, playlistId);
  await db.delete(playlistItems).where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)));
}

/** A playlist with its videos — public ones for anyone, private ones for their owner only. */
export async function playlistWithItems(playlistId: string, viewerId: string | null) {
  const [row] = await db
    .select({
      ...card,
      ownerId: playlists.creatorId,
      ownerUsername: users.username,
      ownerName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
    })
    .from(playlists)
    .innerJoin(users, eq(users.id, playlists.creatorId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(playlists.id, playlistId))
    .limit(1);
  if (!row || (row.isPrivate && row.ownerId !== viewerId)) throw new HttpError(404, "Playlist not found");
  const items: VideoSummary[] = await db
    .select({
      id: videos.id,
      title: videos.title,
      creatorName: sql<string>`(select coalesce(p.display_name, u.username) from users u left join profiles p on p.user_id = u.id where u.id = videos.creator_id)`,
      creatorUsername: sql<string>`(select u.username from users u where u.id = videos.creator_id)`,
      creatorAvatar: sql<string | null>`(select p.avatar_url from profiles p where p.user_id = videos.creator_id)`,
      thumbnailUrl: videos.thumbnailUrl,
      previewAnimationUrl: videos.previewAnimationUrl,
      durationSeconds: videos.durationSeconds,
      visibility: videos.visibility,
      minTipAmountCents: videos.minTipAmountCents,
      viewsCount: videos.viewsCount,
      tipsCount: videos.tipsCount,
    })
    .from(playlistItems)
    .innerJoin(videos, eq(videos.id, playlistItems.videoId))
    .where(and(eq(playlistItems.playlistId, playlistId), eq(videos.status, "READY"), isNull(videos.removedAt)))
    .orderBy(asc(playlistItems.position));
  return { ...row, items };
}
