import crypto from "crypto";
import { db, videos, videoViews, videoLikes, videoComments, videoShares, users, profiles } from "@orochia/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { evaluateVideoAccess } from "./access";
import { sessionSecret } from "./env";
import { HttpError } from "./http";
import type { SessionUser } from "./auth";
import { after } from "next/server";
import { notifyComment } from "./notifications";

/**
 * Views, likes, comments and shares. Each counter on `videos` moves in the same transaction as the
 * row that justifies it, so the figures shown always match the records. Liking, reading and writing
 * comments require the same access as playing the video.
 */

export const COMMENT_MAX_LENGTH = 2000;
export const SHARE_CHANNELS = ["LINK", "X", "WHATSAPP", "TELEGRAM", "EMAIL", "OTHER"] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

/** A video the viewer may watch, or a 404/403 they would get on its stream. */
async function requireWatchable(videoId: string, viewerId: string | null) {
  const access = await evaluateVideoAccess(videoId, viewerId);
  if (access.reason === "NOT_FOUND") throw new HttpError(404, "Video not found");
  if (!access.allowed) throw new HttpError(403, "You cannot access this video");
  return access;
}

/**
 * Who a view belongs to: the account, or for a guest a salted hash of address and user agent
 * (rotating daily with the date in the unique key) — the address itself is never stored.
 */
export function viewerKey(viewerId: string | null, network: { ip: string | null; userAgent: string | null }): string {
  if (viewerId) return `u:${viewerId}`;
  const digest = crypto
    .createHmac("sha256", sessionSecret())
    .update(`${network.ip ?? "unknown"}|${network.userAgent ?? ""}`)
    .digest("hex");
  return `g:${digest.slice(0, 64)}`;
}

/** Counts a view once per viewer and day; the author's own plays never count. */
export async function recordView(
  video: { id: string; creatorId: string },
  viewerId: string | null,
  network: { ip: string | null; userAgent: string | null },
): Promise<boolean> {
  if (viewerId && viewerId === video.creatorId) return false;
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(videoViews)
      .values({ videoId: video.id, viewerId, viewerKey: viewerKey(viewerId, network) })
      .onConflictDoNothing()
      .returning({ id: videoViews.id });
    if (inserted.length === 0) return false;
    await tx.update(videos).set({ viewsCount: sql`${videos.viewsCount} + 1` }).where(eq(videos.id, video.id));
    return true;
  });
}

/** Likes or unlikes a video; returns the new state and count. */
export async function setLike(user: SessionUser, videoId: string, liked: boolean) {
  await requireWatchable(videoId, user.id);
  return db.transaction(async (tx) => {
    const changed = liked
      ? await tx.insert(videoLikes).values({ videoId, userId: user.id }).onConflictDoNothing().returning({ id: videoLikes.id })
      : await tx
          .delete(videoLikes)
          .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userId, user.id)))
          .returning({ id: videoLikes.id });
    const delta = changed.length === 0 ? 0 : liked ? 1 : -1;
    const [row] = await tx
      .update(videos)
      .set({ likesCount: sql`greatest(${videos.likesCount} + ${delta}, 0)` })
      .where(eq(videos.id, videoId))
      .returning({ likesCount: videos.likesCount });
    return { liked, likesCount: row.likesCount };
  });
}

/** Whether the viewer liked a video (false for guests). */
export async function hasLiked(viewerId: string | null, videoId: string): Promise<boolean> {
  if (!viewerId) return false;
  const [row] = await db
    .select({ id: videoLikes.id })
    .from(videoLikes)
    .where(and(eq(videoLikes.videoId, videoId), eq(videoLikes.userId, viewerId)))
    .limit(1);
  return Boolean(row);
}

export interface CommentView {
  id: string;
  parentId: string | null;
  body: string | null;
  authorUsername: string;
  authorName: string;
  authorAvatar: string | null;
  createdAt: Date;
  editedAt: Date | null;
  removed: boolean;
  canRemove: boolean;
}

/**
 * The discussion of a video, oldest first (replies are grouped by the client under `parentId`).
 * A removed comment keeps its place without its text so the thread stays readable.
 */
export async function listComments(videoId: string, viewer: SessionUser | null): Promise<CommentView[]> {
  const access = await requireWatchable(videoId, viewer?.id ?? null);
  const rows = await db
    .select({
      id: videoComments.id,
      parentId: videoComments.parentId,
      body: videoComments.body,
      authorId: videoComments.authorId,
      authorUsername: users.username,
      authorName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      authorAvatar: profiles.avatarUrl,
      createdAt: videoComments.createdAt,
      editedAt: videoComments.editedAt,
      removedAt: videoComments.removedAt,
    })
    .from(videoComments)
    .innerJoin(users, eq(users.id, videoComments.authorId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(videoComments.videoId, videoId), isNull(users.suspendedAt)))
    .orderBy(asc(videoComments.createdAt))
    .limit(500);
  return rows.map(({ authorId, removedAt, ...row }) => ({
    ...row,
    body: removedAt ? null : row.body,
    removed: Boolean(removedAt),
    canRemove:
      !removedAt && Boolean(viewer) && (viewer!.id === authorId || viewer!.id === access.creatorId || viewer!.role === "ADMIN"),
  }));
}

/** Posts a comment or a reply (one level: a reply to a reply attaches to the same thread). */
export async function addComment(user: SessionUser, videoId: string, input: { body: string; parentId?: string | null }) {
  await requireWatchable(videoId, user.id);
  const [video] = await db.select({ commentsEnabled: videos.commentsEnabled }).from(videos).where(eq(videos.id, videoId)).limit(1);
  if (!video.commentsEnabled) throw new HttpError(403, "Comments are closed on this video");
  let parentId: string | null = null;
  let parentAuthorId: string | null = null;
  if (input.parentId) {
    const [parent] = await db
      .select({ id: videoComments.id, parentId: videoComments.parentId, authorId: videoComments.authorId })
      .from(videoComments)
      .where(and(eq(videoComments.id, input.parentId), eq(videoComments.videoId, videoId)))
      .limit(1);
    if (!parent) throw new HttpError(404, "Comment not found");
    parentId = parent.parentId ?? parent.id;
    parentAuthorId = parent.authorId;
  }
  after(() => notifyComment({ videoId, authorId: user.id, parentAuthorId }));
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(videoComments)
      .values({ videoId, authorId: user.id, parentId, body: input.body })
      .returning({ id: videoComments.id, createdAt: videoComments.createdAt });
    await tx.update(videos).set({ commentsCount: sql`${videos.commentsCount} + 1` }).where(eq(videos.id, videoId));
    return row;
  });
}

/** Removes a comment: its author, the video's creator or an operator. */
export async function removeComment(user: SessionUser, videoId: string, commentId: string) {
  const [row] = await db
    .select({ authorId: videoComments.authorId, removedAt: videoComments.removedAt, creatorId: videos.creatorId })
    .from(videoComments)
    .innerJoin(videos, eq(videos.id, videoComments.videoId))
    .where(and(eq(videoComments.id, commentId), eq(videoComments.videoId, videoId)))
    .limit(1);
  const allowed = row && (row.authorId === user.id || row.creatorId === user.id || user.role === "ADMIN");
  if (!row || !allowed || row.removedAt) throw new HttpError(404, "Comment not found");
  await db.transaction(async (tx) => {
    await tx.update(videoComments).set({ removedAt: new Date(), removedBy: user.id }).where(eq(videoComments.id, commentId));
    await tx
      .update(videos)
      .set({ commentsCount: sql`greatest(${videos.commentsCount} - 1, 0)` })
      .where(eq(videos.id, videoId));
  });
}

/**
 * Records a share. The shared link is the watch page, which still enforces the video's own access:
 * sharing never opens a video to someone who could not watch it.
 */
export async function recordShare(viewerId: string | null, videoId: string, channel: ShareChannel) {
  await requireWatchable(videoId, viewerId);
  return db.transaction(async (tx) => {
    await tx.insert(videoShares).values({ videoId, userId: viewerId, channel });
    const [row] = await tx
      .update(videos)
      .set({ sharesCount: sql`${videos.sharesCount} + 1` })
      .where(eq(videos.id, videoId))
      .returning({ sharesCount: videos.sharesCount });
    return row;
  });
}
