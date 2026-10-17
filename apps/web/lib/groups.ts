import { createHash, randomBytes } from "node:crypto";

import { conversationInvites, conversationMembers, conversations, db, directMessages, profiles, users } from "@orochia/db";
import { addDays, addHours } from "date-fns";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { after } from "next/server";

import { ConversationKind, MemberRole } from "./conversation-kinds";
import { canAddMembers, INVITE_TTL_DAYS, inviteState, isMuted, MAX_GROUP_MEMBERS, nextOwner, parseGroupTitle } from "./group-rules";
import { HttpError } from "./http";
import { conversationFor, emitUnread, emitUserEvent, MESSAGE_MAX_LENGTH, type MessageView,messageView } from "./messaging";
import { notifyMessage } from "./notifications";

/**
 * Group conversations (ADR 0002): at most 50 members, one owner, invites, mute, leave. Every route resolves
 * membership first (`conversationFor`: a non-member gets 404, a group's existence is never disclosed). People are added
 * only when they are an accepted contact of the person adding, or — for a creator's fan group — an approved follower;
 * never across a block.
 */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Of `candidateIds`, the people `actorId` may bring into a group: active, no block either way, a contact or an approved fan. */
export async function eligibleToAdd(actorId: string, candidateIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(candidateIds)].filter((id) => id !== actorId);
  if (ids.length === 0) return new Set();
  const list = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  const result = await db.execute<{ id: string }>(sql`
    select u.id from users u
     where u.id in (${list}) and u.suspended_at is null and u.email_verified_at is not null
       and not exists (select 1 from blocked_users b
                        where (b.blocker_id = ${actorId} and b.blocked_id = u.id) or (b.blocker_id = u.id and b.blocked_id = ${actorId}))
       and (
         exists (select 1 from contacts c where c.status = 'ACCEPTED'
                  and ((c.requester_id = ${actorId} and c.addressee_id = u.id) or (c.requester_id = u.id and c.addressee_id = ${actorId})))
         or exists (select 1 from follows f join users me on me.id = ${actorId}
                     where f.follower_id = u.id and f.creator_id = ${actorId} and f.status = 'APPROVED' and me.role in ('CREATOR', 'ADMIN'))
       )`);
  return new Set(result.rows.map((r) => r.id));
}

async function activeCount(tx: Tx, conversationId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<string>`count(*)` })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)));
  return Number(row?.n ?? 0);
}

async function lockGroup(tx: Tx, conversationId: string): Promise<{ archivedAt: Date | null; title: string | null }> {
  const result = await tx.execute<{ kind: string; archived_at: Date | string | null; title: string | null }>(
    sql`select kind, archived_at, title from conversations where id = ${conversationId} for update`,
  );
  const row = result.rows[0];
  if (!row || row.kind !== ConversationKind.Group) throw new HttpError(404, "Conversation not found");
  return { archivedAt: row.archived_at ? new Date(row.archived_at) : null, title: row.title };
}

async function requireOwner(conversationId: string, userId: string) {
  const access = await conversationFor(conversationId, userId);
  if (access.kind !== ConversationKind.Group) throw new HttpError(404, "Conversation not found");
  if (access.role !== MemberRole.Owner) throw new HttpError(403, "Only the owner of the group can do this", { code: "GROUP_OWNER_ONLY" });
  return access;
}

/** Tells the members' apps the group changed (title, members): they reload the list. */
async function emitGroupChanged(conversationId: string, extraUserIds: string[] = []) {
  const members = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)));
  for (const id of new Set([...members.map((m) => m.userId), ...extraUserIds])) emitUserEvent(id, { type: "conversation_changed", conversationId });
}

export async function createGroup(creatorId: string, input: { title: string; memberIds: string[] }): Promise<string> {
  const title = parseGroupTitle(input.title);
  if (!title) throw new HttpError(400, "A group needs a name");
  const memberIds = [...new Set(input.memberIds)].filter((id) => id !== creatorId);
  if (!canAddMembers(1, memberIds.length)) throw new HttpError(400, `A group holds between 2 and ${MAX_GROUP_MEMBERS} people`, { code: "GROUP_SIZE" });
  const allowed = await eligibleToAdd(creatorId, memberIds);
  if (memberIds.some((id) => !allowed.has(id))) throw new HttpError(403, "You can only add your contacts", { code: "GROUP_MEMBER_NOT_ALLOWED" });
  const id = await db.transaction(async (tx) => {
    const [created] = await tx.insert(conversations).values({ kind: "group", title, createdBy: creatorId, lastMessageAt: new Date() }).returning({ id: conversations.id });
    await tx.insert(conversationMembers).values([
      { conversationId: created.id, userId: creatorId, role: "owner" },
      ...memberIds.map((userId) => ({ conversationId: created.id, userId })),
    ]);
    return created.id;
  });
  await emitGroupChanged(id);
  return id;
}

export async function addMembers(actorId: string, conversationId: string, memberIds: string[]): Promise<void> {
  await requireOwner(conversationId, actorId);
  const ids = [...new Set(memberIds)];
  const allowed = await eligibleToAdd(actorId, ids);
  if (ids.length === 0 || ids.some((id) => !allowed.has(id))) throw new HttpError(403, "You can only add your contacts", { code: "GROUP_MEMBER_NOT_ALLOWED" });
  await db.transaction(async (tx) => {
    const group = await lockGroup(tx, conversationId);
    if (group.archivedAt) throw new HttpError(409, "This group is closed", { code: "GROUP_CLOSED" });
    const already = await tx
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)));
    const present = new Set(already.map((m) => m.userId));
    const fresh = ids.filter((id) => !present.has(id));
    if (!canAddMembers(present.size, fresh.length)) throw new HttpError(409, `A group holds at most ${MAX_GROUP_MEMBERS} people`, { code: "GROUP_FULL" });
    await seat(tx, conversationId, fresh);
  });
  await emitGroupChanged(conversationId);
}

/** Seats people: new rows, or a returning member's row (their read cursor starts at the end: no old history as unread). */
async function seat(tx: Tx, conversationId: string, userIds: string[]) {
  for (const userId of userIds) {
    await tx
      .insert(conversationMembers)
      .values({ conversationId, userId, lastReadSeq: sql`coalesce((select max(seq) from direct_messages where conversation_id = ${conversationId}), 0)` as unknown as number })
      .onConflictDoUpdate({
        target: [conversationMembers.conversationId, conversationMembers.userId],
        set: { leftAt: null, joinedAt: new Date(), role: "member", mutedUntil: null, lastReadSeq: sql`coalesce((select max(seq) from direct_messages where conversation_id = ${conversationId}), 0)` },
      });
  }
}

export interface GroupMember {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "owner" | "member";
  joinedAt: Date;
}

export async function listMembers(viewerId: string, conversationId: string): Promise<{ title: string | null; archived: boolean; muted: boolean; role: "owner" | "member"; members: GroupMember[] }> {
  const access = await conversationFor(conversationId, viewerId);
  if (access.kind !== ConversationKind.Group) throw new HttpError(404, "Conversation not found");
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      avatarUrl: profiles.avatarUrl,
      role: conversationMembers.role,
      joinedAt: conversationMembers.joinedAt,
      mutedUntil: conversationMembers.mutedUntil,
    })
    .from(conversationMembers)
    .innerJoin(users, eq(users.id, conversationMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)))
    .orderBy(asc(conversationMembers.joinedAt));
  const [group] = await db.select({ title: conversations.title, archivedAt: conversations.archivedAt }).from(conversations).where(eq(conversations.id, conversationId)).limit(1);
  const mine = rows.find((r) => r.userId === viewerId);
  return {
    title: group?.title ?? null,
    archived: Boolean(group?.archivedAt),
    muted: isMuted(mine?.mutedUntil ?? null, new Date()),
    role: access.role,
    members: rows.map((r) => ({ userId: r.userId, username: r.username, displayName: r.displayName, avatarUrl: r.avatarUrl, role: r.role === MemberRole.Owner ? "owner" : "member", joinedAt: r.joinedAt })),
  };
}

export async function renameGroup(actorId: string, conversationId: string, title: string): Promise<void> {
  await requireOwner(conversationId, actorId);
  const clean = parseGroupTitle(title);
  if (!clean) throw new HttpError(400, "A group needs a name");
  await db.update(conversations).set({ title: clean, updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  await emitGroupChanged(conversationId);
}

export async function removeMember(actorId: string, conversationId: string, memberId: string): Promise<void> {
  await requireOwner(conversationId, actorId);
  if (memberId === actorId) throw new HttpError(400, "Use leave to go out of your own group");
  const removed = await db
    .update(conversationMembers)
    .set({ leftAt: new Date() })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, memberId), isNull(conversationMembers.leftAt)))
    .returning({ userId: conversationMembers.userId });
  if (removed.length === 0) throw new HttpError(404, "Member not found");
  await emitGroupChanged(conversationId, [memberId]);
  await emitUnread(memberId);
}

/** Leaves a group. The owner leaving passes the group on (longest-standing member); alone, the group is closed. */
export async function leaveGroup(userId: string, conversationId: string): Promise<void> {
  const access = await conversationFor(conversationId, userId);
  if (access.kind !== ConversationKind.Group) throw new HttpError(404, "Conversation not found");
  await db.transaction(async (tx) => {
    await lockGroup(tx, conversationId);
    await tx
      .update(conversationMembers)
      .set({ leftAt: new Date(), role: "member" })
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    if (access.role !== MemberRole.Owner) return;
    const rest = await tx
      .select({ userId: conversationMembers.userId, joinedAt: conversationMembers.joinedAt })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)));
    const heir = nextOwner(rest);
    if (heir) await tx.update(conversationMembers).set({ role: "owner" }).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, heir)));
    else await tx.update(conversations).set({ archivedAt: new Date() }).where(eq(conversations.id, conversationId));
  });
  await emitGroupChanged(conversationId, [userId]);
  await emitUnread(userId);
}

/** Closes a group: nobody writes any more, members still read. */
export async function closeGroup(actorId: string, conversationId: string): Promise<void> {
  await requireOwner(conversationId, actorId);
  await db.update(conversations).set({ archivedAt: new Date() }).where(eq(conversations.id, conversationId));
  await emitGroupChanged(conversationId);
}

/** Mutes a group for `hours` (no push, no badge), or unmutes with `null`. */
export async function setMute(userId: string, conversationId: string, hours: number | null): Promise<void> {
  const access = await conversationFor(conversationId, userId);
  if (access.kind !== ConversationKind.Group) throw new HttpError(404, "Conversation not found");
  await db
    .update(conversationMembers)
    .set({ mutedUntil: hours === null ? null : addHours(new Date(), hours) })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  await emitUnread(userId);
  emitUserEvent(userId, { type: "conversation_changed", conversationId });
}

// ── Invites ─────────────────────────────────────────────────────────────────────────────────────

/** A new invite link's token (shown once; only its hash is stored). Owner only. */
export async function createInvite(actorId: string, conversationId: string, maxUses = MAX_GROUP_MEMBERS): Promise<{ token: string; expiresAt: Date }> {
  await requireOwner(conversationId, actorId);
  const token = randomBytes(24).toString("base64url");
  const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);
  await db.insert(conversationInvites).values({ conversationId, tokenHash: sha256(token), createdBy: actorId, expiresAt, maxUses: Math.min(Math.max(maxUses, 1), MAX_GROUP_MEMBERS) });
  return { token, expiresAt };
}

export async function revokeInvites(actorId: string, conversationId: string): Promise<void> {
  await requireOwner(conversationId, actorId);
  await db.update(conversationInvites).set({ revokedAt: new Date() }).where(and(eq(conversationInvites.conversationId, conversationId), isNull(conversationInvites.revokedAt)));
}

/** Joins a group by invite token. A bad, expired, revoked or used-up token is a 404/410 — never a hint about the group. */
export async function joinByInvite(userId: string, token: string): Promise<string> {
  const [invite] = await db.select().from(conversationInvites).where(eq(conversationInvites.tokenHash, sha256(token))).limit(1);
  if (!invite) throw new HttpError(404, "This invitation is not valid");
  const conversationId = invite.conversationId;
  await db.transaction(async (tx) => {
    const group = await lockGroup(tx, conversationId);
    if (group.archivedAt) throw new HttpError(410, "This invitation is no longer valid", { code: "INVITE_INVALID" });
    const [current] = await tx.select().from(conversationInvites).where(eq(conversationInvites.id, invite.id)).for("update").limit(1);
    const [mine] = await tx
      .select({ leftAt: conversationMembers.leftAt })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
    if (mine && !mine.leftAt) return; // already in
    const count = await activeCount(tx, conversationId);
    const state = inviteState(current, new Date(), MAX_GROUP_MEMBERS - count);
    if (state === "full") throw new HttpError(409, `A group holds at most ${MAX_GROUP_MEMBERS} people`, { code: "GROUP_FULL" });
    if (state !== "ok") throw new HttpError(410, "This invitation is no longer valid", { code: "INVITE_INVALID" });
    await seat(tx, conversationId, [userId]);
    await tx.update(conversationInvites).set({ uses: sql`${conversationInvites.uses} + 1` }).where(eq(conversationInvites.id, invite.id));
  });
  await emitGroupChanged(conversationId, [userId]);
  return conversationId;
}

// ── Messages ────────────────────────────────────────────────────────────────────────────────────

/**
 * A member writes in a group (idempotent per `clientId`). Every active member's stream gets the message; the muted
 * ones get no push.
 */
export async function sendGroupMessage(senderId: string, conversationId: string, text: string, options: { clientId?: string } = {}): Promise<MessageView & { duplicate?: boolean }> {
  const content = text.trim();
  if (!content) throw new HttpError(400, "Message cannot be empty");
  if (content.length > MESSAGE_MAX_LENGTH) throw new HttpError(400, `Message exceeds ${MESSAGE_MAX_LENGTH} characters limit`);
  const access = await conversationFor(conversationId, senderId);
  if (access.kind !== ConversationKind.Group) throw new HttpError(404, "Conversation not found");

  if (options.clientId) {
    const [existing] = await db
      .select()
      .from(directMessages)
      .where(and(eq(directMessages.senderId, senderId), eq(directMessages.clientId, options.clientId)))
      .limit(1);
    if (existing) return { ...messageView(existing), duplicate: true };
  }

  const inserted = await db.transaction(async (tx) => {
    const group = await lockGroup(tx, conversationId);
    if (group.archivedAt) throw new HttpError(409, "This group is closed", { code: "GROUP_CLOSED" });
    const [row] = await tx
      .insert(directMessages)
      .values({ conversationId, senderId, recipientId: null, content, clientId: options.clientId ?? null, isRead: false })
      .onConflictDoNothing({ target: [directMessages.senderId, directMessages.clientId] })
      .returning();
    if (row) {
      await tx.update(conversations).set({ lastMessageAt: row.createdAt, updatedAt: new Date() }).where(eq(conversations.id, conversationId));
      // One's own message is read by oneself.
      await tx.update(conversationMembers).set({ lastReadSeq: sql`greatest(${conversationMembers.lastReadSeq}, ${row.seq})` }).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, senderId)));
    }
    return row;
  });
  if (!inserted) {
    const [existing] = await db.select().from(directMessages).where(and(eq(directMessages.senderId, senderId), eq(directMessages.clientId, options.clientId!))).limit(1);
    return { ...messageView(existing), duplicate: true };
  }
  const result = messageView(inserted);
  const members = await db
    .select({ userId: conversationMembers.userId, mutedUntil: conversationMembers.mutedUntil })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)));
  const now = new Date();
  for (const m of members) emitUserEvent(m.userId, { type: m.userId === senderId ? "message_sent" : "new_message", message: result });
  after(async () => {
    for (const m of members) {
      if (m.userId === senderId) continue;
      await emitUnread(m.userId);
      if (!isMuted(m.mutedUntil, now)) await notifyMessage(m.userId, senderId, conversationId).catch(() => undefined);
    }
  });
  return result;
}
