import { db, playlists, playlistItems, playlistMembers, playlistAudienceLists, audienceListMembers, videos, users, profiles } from "@orochia/db";
import { and, asc, desc, eq, exists, isNull, or, sql } from "drizzle-orm";
import { canOpenCollection, evaluateVideoAccess, type CollectionVisibility } from "./access";
import { HttpError } from "./http";
import { withSignedMedia } from "./media-urls";
import type { VideoSummary } from "./queries";

/**
 * Collections (playlists): any account curates them and decides who opens each one — everyone,
 * its approved followers, its contacts, the accounts it invited, or nobody else. Items are video
 * summaries only — a collection never grants access, each play still goes through lib/access.ts.
 */

export interface PlaylistCard {
  id: string;
  title: string;
  description: string | null;
  visibility: CollectionVisibility;
  itemsCount: number;
  membersCount: number;
  listsCount: number;
  coverUrl: string | null;
  updatedAt: Date;
}

const card = {
  id: playlists.id,
  title: playlists.title,
  description: playlists.description,
  visibility: playlists.visibility,
  updatedAt: playlists.updatedAt,
  itemsCount: sql<number>`(select count(*)::int from ${playlistItems} pi join ${videos} v on v.id = pi.video_id where pi.playlist_id = playlists.id and v.removed_at is null)`,
  membersCount: sql<number>`(select count(*)::int from ${playlistMembers} pm where pm.playlist_id = playlists.id)`,
  listsCount: sql<number>`(select count(*)::int from ${playlistAudienceLists} pl where pl.playlist_id = playlists.id)`,
  coverUrl: sql<string | null>`(select v.thumbnail_url from ${playlistItems} pi join ${videos} v on v.id = pi.video_id where pi.playlist_id = playlists.id and v.removed_at is null order by pi.position limit 1)`,
};

export async function myPlaylists(ownerId: string): Promise<PlaylistCard[]> {
  const rows = await db.select(card).from(playlists).where(eq(playlists.creatorId, ownerId)).orderBy(desc(playlists.updatedAt));
  return rows.map(withSignedMedia);
}

/** The owner's collections this viewer may open (all of them for the owner). */
export async function visiblePlaylists(ownerId: string, viewerId: string | null): Promise<PlaylistCard[]> {
  const rows = await db.select(card).from(playlists).where(eq(playlists.creatorId, ownerId)).orderBy(desc(playlists.updatedAt));
  const allowed = await Promise.all(rows.map((row) => canOpenCollection({ id: row.id, ownerId, visibility: row.visibility }, viewerId)));
  return rows.filter((_, index) => allowed[index]).map(withSignedMedia);
}

/** Collections other accounts invited this viewer to, directly or through one of their lists. */
export async function sharedWithMe(viewerId: string): Promise<(PlaylistCard & { ownerUsername: string })[]> {
  const direct = db
    .select({ id: playlistMembers.id })
    .from(playlistMembers)
    .where(and(eq(playlistMembers.playlistId, playlists.id), eq(playlistMembers.userId, viewerId)));
  const throughList = db
    .select({ id: playlistAudienceLists.id })
    .from(playlistAudienceLists)
    .innerJoin(audienceListMembers, eq(audienceListMembers.listId, playlistAudienceLists.listId))
    .where(and(eq(playlistAudienceLists.playlistId, playlists.id), eq(audienceListMembers.userId, viewerId)));
  return db
    .select({ ...card, ownerUsername: users.username })
    .from(playlists)
    .innerJoin(users, eq(users.id, playlists.creatorId))
    .where(and(eq(playlists.visibility, "INVITED_ONLY"), isNull(users.suspendedAt), or(exists(direct), exists(throughList))))
    .orderBy(desc(playlists.updatedAt))
    .then((rows) => rows.map(withSignedMedia));
}

export async function createPlaylist(
  ownerId: string,
  input: { title: string; description?: string | null; visibility?: CollectionVisibility },
) {
  const [row] = await db
    .insert(playlists)
    .values({ creatorId: ownerId, title: input.title, description: input.description ?? null, visibility: input.visibility ?? "PRIVATE" })
    .returning({ id: playlists.id });
  return row;
}

async function owned(ownerId: string, playlistId: string) {
  const [row] = await db.select().from(playlists).where(eq(playlists.id, playlistId)).limit(1);
  if (!row || row.creatorId !== ownerId) throw new HttpError(404, "Playlist not found");
  return row;
}

export async function updatePlaylist(
  ownerId: string,
  playlistId: string,
  patch: { title?: string; description?: string | null; visibility?: CollectionVisibility },
) {
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

/** A collection with its videos, for a viewer its permission admits (others get a 404). */
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
  if (!row || !(await canOpenCollection({ id: row.id, ownerId: row.ownerId, visibility: row.visibility }, viewerId))) {
    throw new HttpError(404, "Playlist not found");
  }
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
      likesCount: videos.likesCount,
      commentsCount: videos.commentsCount,
    })
    .from(playlistItems)
    .innerJoin(videos, eq(videos.id, playlistItems.videoId))
    .where(and(eq(playlistItems.playlistId, playlistId), eq(videos.status, "READY"), isNull(videos.removedAt)))
    .orderBy(asc(playlistItems.position));
  // Invited-only videos stay hidden from viewers they were not shared with.
  const shown = await Promise.all(
    items.map(async (v) => v.visibility !== "INVITED_ONLY" || (await evaluateVideoAccess(v.id, viewerId)).allowed),
  );
  return withSignedMedia({ ...row, isOwner: row.ownerId === viewerId, items: items.filter((_, i) => shown[i]).map(withSignedMedia) });
}
