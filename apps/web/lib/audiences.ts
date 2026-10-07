import {
  db,
  users,
  profiles,
  videos,
  playlists,
  playlistMembers,
  videoViewers,
  audienceLists,
  audienceListMembers,
  videoAudienceLists,
  playlistAudienceLists,
} from "@orochia/db";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { HttpError, isUniqueViolation } from "./http";
import { appUrl } from "./env";
import { sendMail } from "./mail";

/**
 * Who an INVITED_ONLY video or collection is open to: accounts invited one by one, and the owner's
 * reusable audience lists. Lists are live — a member added later is let in, a member removed is
 * shut out — and private to their owner. Every rule about invitations lives here.
 */

export const LIST_NAME_MAX = 80;

export interface AudiencePerson {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface AudienceListCard {
  id: string;
  name: string;
  membersCount: number;
}

const person = {
  userId: users.id,
  username: users.username,
  displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
  avatarUrl: profiles.avatarUrl,
};

/** An active account by username; yourself and suspended accounts are a 404. */
async function accountByUsername(username: string, ownerId: string) {
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.username, username.trim().toLowerCase().replace(/^@/, "")), isNull(users.suspendedAt)))
    .limit(1);
  if (!row || row.id === ownerId) throw new HttpError(404, "Account not found");
  return row;
}

// ── Lists ────────────────────────────────────────────────────────────────────────────────────

const listCard = {
  id: audienceLists.id,
  name: audienceLists.name,
  membersCount: sql<number>`(select count(*)::int from ${audienceListMembers} m where m.list_id = audience_lists.id)`,
};

export async function myLists(ownerId: string): Promise<AudienceListCard[]> {
  return db.select(listCard).from(audienceLists).where(eq(audienceLists.ownerId, ownerId)).orderBy(asc(audienceLists.name));
}

async function ownedList(ownerId: string, listId: string) {
  const [row] = await db.select().from(audienceLists).where(eq(audienceLists.id, listId)).limit(1);
  if (!row || row.ownerId !== ownerId) throw new HttpError(404, "List not found");
  return row;
}

export async function createList(ownerId: string, name: string) {
  try {
    const [row] = await db.insert(audienceLists).values({ ownerId, name: name.trim() }).returning({ id: audienceLists.id });
    return row;
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "You already have a list with this name");
    throw error;
  }
}

export async function renameList(ownerId: string, listId: string, name: string) {
  await ownedList(ownerId, listId);
  try {
    await db.update(audienceLists).set({ name: name.trim(), updatedAt: new Date() }).where(eq(audienceLists.id, listId));
  } catch (error) {
    if (isUniqueViolation(error)) throw new HttpError(409, "You already have a list with this name");
    throw error;
  }
}

/** Deleting a list closes what it opened (its attachments go with it). */
export async function deleteList(ownerId: string, listId: string) {
  await ownedList(ownerId, listId);
  await db.delete(audienceLists).where(eq(audienceLists.id, listId));
}

export async function listPeople(ownerId: string, listId: string): Promise<AudiencePerson[]> {
  await ownedList(ownerId, listId);
  return db
    .select(person)
    .from(audienceListMembers)
    .innerJoin(users, eq(users.id, audienceListMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(audienceListMembers.listId, listId))
    .orderBy(asc(users.username));
}

/** Adds an account to a list (idempotent). Lists are private: the member is not notified. */
export async function addToList(ownerId: string, listId: string, username: string) {
  await ownedList(ownerId, listId);
  const account = await accountByUsername(username, ownerId);
  await db.insert(audienceListMembers).values({ listId, userId: account.id }).onConflictDoNothing();
  await db.update(audienceLists).set({ updatedAt: new Date() }).where(eq(audienceLists.id, listId));
  return { userId: account.id };
}

export async function removeFromList(ownerId: string, listId: string, userId: string) {
  await ownedList(ownerId, listId);
  await db.delete(audienceListMembers).where(and(eq(audienceListMembers.listId, listId), eq(audienceListMembers.userId, userId)));
}

// ── Audience of a video or a collection ──────────────────────────────────────────────────────

export type AudienceTarget = "video" | "collection";

const targets = {
  video: { people: videoViewers, peopleKey: videoViewers.videoId, lists: videoAudienceLists, listsKey: videoAudienceLists.videoId },
  collection: {
    people: playlistMembers,
    peopleKey: playlistMembers.playlistId,
    lists: playlistAudienceLists,
    listsKey: playlistAudienceLists.playlistId,
  },
} as const;

/** The target, if this account owns it (a withdrawn video counts as absent). */
async function ownedTarget(kind: AudienceTarget, ownerId: string, id: string): Promise<{ title: string }> {
  const [row] =
    kind === "video"
      ? await db
          .select({ title: videos.title })
          .from(videos)
          .where(and(eq(videos.id, id), eq(videos.creatorId, ownerId), isNull(videos.removedAt)))
          .limit(1)
      : await db
          .select({ title: playlists.title })
          .from(playlists)
          .where(and(eq(playlists.id, id), eq(playlists.creatorId, ownerId)))
          .limit(1);
  if (!row) throw new HttpError(404, kind === "video" ? "Video not found" : "Playlist not found");
  return row;
}

export async function audienceOf(kind: AudienceTarget, ownerId: string, id: string) {
  await ownedTarget(kind, ownerId, id);
  const t = targets[kind];
  const [people, lists] = await Promise.all([
    db
      .select(person)
      .from(t.people)
      .innerJoin(users, eq(users.id, t.people.userId))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(t.peopleKey, id))
      .orderBy(asc(users.username)),
    db
      .select(listCard)
      .from(t.lists)
      .innerJoin(audienceLists, eq(audienceLists.id, t.lists.listId))
      .where(eq(t.listsKey, id))
      .orderBy(asc(audienceLists.name)),
  ]);
  return { people, lists };
}

/** Invites one account (idempotent) and tells them by e-mail the first time. */
export async function invitePerson(kind: AudienceTarget, ownerId: string, id: string, username: string) {
  const target = await ownedTarget(kind, ownerId, id);
  const account = await accountByUsername(username, ownerId);
  const added =
    kind === "video"
      ? await db.insert(videoViewers).values({ videoId: id, userId: account.id }).onConflictDoNothing().returning({ id: videoViewers.id })
      : await db.insert(playlistMembers).values({ playlistId: id, userId: account.id }).onConflictDoNothing().returning({ id: playlistMembers.id });
  if (added.length > 0) {
    const [owner] = await db.select({ username: users.username }).from(users).where(eq(users.id, ownerId)).limit(1);
    const what = kind === "video" ? "a video" : "a collection";
    const link = `${appUrl()}/${kind === "video" ? "watch" : "playlists"}/${id}`;
    void sendMail({
      to: account.email,
      subject: `@${owner.username} shared ${what} with you on Orochia`,
      text: `@${owner.username} invited you to ${what}: "${target.title}".\n\n${link}\n\n— Orochia`,
    });
  }
  return { userId: account.id };
}

export async function uninvitePerson(kind: AudienceTarget, ownerId: string, id: string, userId: string) {
  await ownedTarget(kind, ownerId, id);
  const t = targets[kind];
  await db.delete(t.people).where(and(eq(t.peopleKey, id), eq(t.people.userId, userId)));
}

/** Opens the target to one of the owner's lists (idempotent). */
export async function attachList(kind: AudienceTarget, ownerId: string, id: string, listId: string) {
  await ownedTarget(kind, ownerId, id);
  await ownedList(ownerId, listId);
  if (kind === "video") await db.insert(videoAudienceLists).values({ videoId: id, listId }).onConflictDoNothing();
  else await db.insert(playlistAudienceLists).values({ playlistId: id, listId }).onConflictDoNothing();
}

export async function detachList(kind: AudienceTarget, ownerId: string, id: string, listId: string) {
  await ownedTarget(kind, ownerId, id);
  const t = targets[kind];
  await db.delete(t.lists).where(and(eq(t.listsKey, id), eq(t.lists.listId, listId)));
}

/** Whether a viewer was invited to the target, directly or through one of its lists. */
export async function isInvited(kind: AudienceTarget, id: string, viewerId: string): Promise<boolean> {
  const t = targets[kind];
  const [direct] = await db
    .select({ id: t.people.id })
    .from(t.people)
    .where(and(eq(t.peopleKey, id), eq(t.people.userId, viewerId)))
    .limit(1);
  if (direct) return true;
  const [throughList] = await db
    .select({ id: audienceListMembers.id })
    .from(t.lists)
    .innerJoin(audienceListMembers, eq(audienceListMembers.listId, t.lists.listId))
    .where(and(eq(t.listsKey, id), eq(audienceListMembers.userId, viewerId)))
    .limit(1);
  return Boolean(throughList);
}
