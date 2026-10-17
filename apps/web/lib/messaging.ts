import { blockedUsers, complianceReports, contacts, conversationMembers, conversations, db, directMessages, profiles, users } from "@orochia/db";
import { compareDesc } from "date-fns";
import { and, desc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { after } from "next/server";

import { ConversationKind, MemberRole } from "./conversation-kinds";
import { HttpError } from "./http";
import { type MessageOrigin,parseMessageOrigin } from "./message-origin";
import { notifyMessage } from "./notifications";
import { circleChanged, presenceFor, type PresenceView } from "./presence";
import { publish } from "./realtime";

/**
 * Direct messages, Messenger-style. The database is the truth (a message exists once it is committed); the realtime
 * bus only tells open apps sooner. Every live event lands on `user:<id>`:
 *
 * - `new_message` / `message_sent` — the message (to the recipient / to the sender's other apps), SSE id `m<seq>`;
 * - `receipt` — `{ conversationId, state: "delivered" | "read", upTo, at }` to the sender: every message of theirs in
 *   that conversation up to `seq = upTo` reached that state;
 * - `unread` — `{ total }`, the account's unread messages (the badge);
 * - `typing` — `{ conversationId, userId, typing }`, never stored;
 * - `circle_changed` — a block or a presence setting changed who sees whom (lib/presence.ts).
 *
 * Order: `seq` is assigned under the conversation's row lock, so a conversation's messages commit in `seq` order.
 * Idempotence: a send carries the app's `clientId`; the same one again answers the message already stored.
 */

/** Pushes an event to one account's open streams, on every app instance (lib/realtime.ts). */
export function emitUserEvent(userId: string, event: Record<string, unknown>): void {
  void publish(`user:${userId}`, event);
}

export interface ConversationSummary {
  id: string;
  /** `group` conversations carry a title and a member count; their `otherUser` is the group itself (id = conversation id). */
  kind: "direct" | "group";
  title: string | null;
  memberCount: number;
  muted: boolean;
  lastMessageAt: Date;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAgeVerified: boolean;
    role: string;
  };
  lastMessage: {
    id: string;
    seq: number;
    content: string;
    senderId: string;
    storyId: string | null;
    createdAt: Date;
    deliveredAt: Date | null;
    isRead: boolean;
  } | null;
  unreadCount: number;
  /** The viewer blocked the other account (the composer offers to unblock). */
  blockedByMe: boolean;
  /** Absent when the viewer may not see it (lib/presence-rules.ts). */
  presence?: PresenceView;
}

export interface MessageView {
  id: string;
  seq: number;
  /** The sender app's id for this message (idempotency). */
  clientId: string | null;
  conversationId: string;
  senderId: string;
  /** The other person of a direct conversation; null in a group. */
  recipientId: string | null;
  content: string;
  /** A private reply to a story: the story it answers (null once that story is gone, or for a plain message). */
  storyId: string | null;
  /** `human`, or `ai_assisted` (shown with its disclosure; lib/message-origin.ts). */
  origin: MessageOrigin;
  deliveredAt: Date | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

type MessageRow = typeof directMessages.$inferSelect;

export function messageView(r: MessageRow): MessageView {
  return {
    id: r.id,
    seq: r.seq,
    clientId: r.clientId,
    conversationId: r.conversationId,
    senderId: r.senderId,
    recipientId: r.recipientId,
    content: r.content,
    storyId: r.storyId,
    origin: parseMessageOrigin(r.origin),
    deliveredAt: r.deliveredAt,
    isRead: r.isRead,
    readAt: r.readAt,
    createdAt: r.createdAt,
  };
}

export const MESSAGE_MAX_LENGTH = 4000;

/**
 * Retrieves an existing conversation between two users or creates one if it doesn't exist.
 */
export async function getOrCreateConversation(userAId: string, userBId: string): Promise<string> {
  if (userAId === userBId) {
    throw new HttpError(400, "Cannot start a conversation with yourself");
  }

  const pair = or(
    and(eq(conversations.participant1Id, userAId), eq(conversations.participant2Id, userBId)),
    and(eq(conversations.participant1Id, userBId), eq(conversations.participant2Id, userAId)),
  );
  const [existing] = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.kind, "direct"), pair)).limit(1);
  if (existing) return existing.id;

  // The conversation and its two members together: every conversation has members (authorisation starts there).
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(conversations)
      .values({ kind: "direct", participant1Id: userAId, participant2Id: userBId, createdBy: userAId, lastMessageAt: new Date() })
      .returning({ id: conversations.id });
    await tx.insert(conversationMembers).values([
      { conversationId: created.id, userId: userAId },
      { conversationId: created.id, userId: userBId },
    ]);
    return created.id;
  });
}

export interface ConversationAccess {
  id: string;
  kind: "direct" | "group";
  /** The other person of a direct conversation; null in a group. */
  otherId: string | null;
  role: "owner" | "member";
}

/**
 * A conversation the user is a member of (not left) — 404 for anyone else, so a group's existence is never disclosed.
 */
export async function conversationFor(conversationId: string, userId: string): Promise<ConversationAccess> {
  const [row] = await db
    .select({
      id: conversations.id,
      kind: conversations.kind,
      p1: conversations.participant1Id,
      p2: conversations.participant2Id,
      role: conversationMembers.role,
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt)))
    .limit(1);
  if (!row) throw new HttpError(404, "Conversation not found");
  return {
    id: row.id,
    kind: row.kind === ConversationKind.Group ? "group" : "direct",
    otherId: row.kind === ConversationKind.Group ? null : row.p1 === userId ? row.p2 : row.p1,
    role: row.role === MemberRole.Owner ? "owner" : "member",
  };
}

/**
 * Checks whether userA is blocked by userB or has blocked userB.
 */
export async function checkBlockStatus(userAId: string, userBId: string): Promise<{ isBlockedByOther: boolean; hasBlockedOther: boolean }> {
  const rows = await db
    .select({ blockerId: blockedUsers.blockerId })
    .from(blockedUsers)
    .where(
      or(
        and(eq(blockedUsers.blockerId, userBId), eq(blockedUsers.blockedId, userAId)),
        and(eq(blockedUsers.blockerId, userAId), eq(blockedUsers.blockedId, userBId))
      )
    );
  return {
    isBlockedByOther: rows.some((r) => r.blockerId === userBId),
    hasBlockedOther: rows.some((r) => r.blockerId === userAId),
  };
}

/**
 * The account's unread messages, all conversations (the badge): direct messages by their receipt, group messages
 * after the member's read cursor — a muted group does not count.
 */
export async function unreadTotal(userId: string): Promise<number> {
  const result = await db.execute<{ total: string }>(sql`
    select (
      (select count(*) from direct_messages where recipient_id = ${userId} and is_read = false)
      +
      (select count(*) from direct_messages m
         join conversation_members cm on cm.conversation_id = m.conversation_id and cm.user_id = ${userId} and cm.left_at is null
         join conversations c on c.id = m.conversation_id and c.kind = 'group'
        where m.seq > cm.last_read_seq and m.sender_id <> ${userId}
          and (cm.muted_until is null or cm.muted_until <= now()))
    ) as total`);
  return Number(result.rows[0]?.total ?? 0);
}

export async function emitUnread(userId: string) {
  emitUserEvent(userId, { type: "unread", total: await unreadTotal(userId) });
}

/**
 * Sends a direct message from sender to recipient: blocks and the recipient's message privacy apply; the same
 * `clientId` twice answers the first message (`duplicate: true`) without sending it again.
 */
export async function sendMessage(
  senderId: string,
  recipientId: string,
  text: string,
  options: { storyId?: string; clientId?: string } = {},
): Promise<MessageView & { duplicate?: boolean }> {
  const content = text.trim();
  if (!content) {
    throw new HttpError(400, "Message cannot be empty");
  }
  if (content.length > MESSAGE_MAX_LENGTH) {
    throw new HttpError(400, `Message exceeds ${MESSAGE_MAX_LENGTH} characters limit`);
  }

  if (options.clientId) {
    const [existing] = await db
      .select()
      .from(directMessages)
      .where(and(eq(directMessages.senderId, senderId), eq(directMessages.clientId, options.clientId)))
      .limit(1);
    if (existing) return { ...messageView(existing), duplicate: true };
  }

  // 1. Verify recipient exists and is active
  const [recipient] = await db
    .select({
      id: users.id,
      suspendedAt: users.suspendedAt,
      directMessagePrivacy: profiles.directMessagePrivacy,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, recipientId))
    .limit(1);

  if (!recipient || recipient.suspendedAt) {
    throw new HttpError(404, "Recipient not found or unavailable");
  }

  // 2. Check blocking
  const { isBlockedByOther, hasBlockedOther } = await checkBlockStatus(senderId, recipientId);
  if (isBlockedByOther) {
    throw new HttpError(403, "You cannot send messages to this user", { code: "MESSAGE_BLOCKED" });
  }
  if (hasBlockedOther) {
    throw new HttpError(403, "You must unblock this user before sending a message", { code: "MESSAGE_YOU_BLOCKED" });
  }

  // 3. Check recipient's direct message privacy preferences
  const privacy = recipient.directMessagePrivacy || "EVERYONE";
  if (privacy === "CONTACTS_ONLY") {
    const [contact] = await db
      .select({ status: contacts.status })
      .from(contacts)
      .where(
        and(
          eq(contacts.status, "ACCEPTED"),
          or(
            and(eq(contacts.requesterId, senderId), eq(contacts.addresseeId, recipientId)),
            and(eq(contacts.requesterId, recipientId), eq(contacts.addresseeId, senderId))
          )
        )
      )
      .limit(1);

    if (!contact) {
      throw new HttpError(403, "This user only accepts messages from mutual contacts", { code: "MESSAGE_CONTACTS_ONLY" });
    }
  }

  // 4. Record the message under the conversation's row lock: a conversation's messages commit in `seq` order.
  const conversationId = await getOrCreateConversation(senderId, recipientId);
  const inserted = await db.transaction(async (tx) => {
    await tx.execute(sql`select id from conversations where id = ${conversationId} for update`);
    const [row] = await tx
      .insert(directMessages)
      .values({ conversationId, senderId, recipientId, content, storyId: options.storyId ?? null, clientId: options.clientId ?? null, isRead: false })
      .onConflictDoNothing({ target: [directMessages.senderId, directMessages.clientId] })
      .returning();
    if (row) await tx.update(conversations).set({ lastMessageAt: row.createdAt, updatedAt: new Date() }).where(eq(conversations.id, conversationId));
    return row;
  });
  if (!inserted) {
    // The same clientId won a race with this request: answer the stored message.
    const [existing] = await db
      .select()
      .from(directMessages)
      .where(and(eq(directMessages.senderId, senderId), eq(directMessages.clientId, options.clientId!)))
      .limit(1);
    return { ...messageView(existing), duplicate: true };
  }

  const result = messageView(inserted);

  // 5. Emit realtime events
  emitUserEvent(recipientId, { type: "new_message", message: result });
  emitUserEvent(senderId, { type: "message_sent", message: result });
  // The badge, the bell, the phone (when no Orochia screen is open) and the e-mail — after the answer.
  after(async () => {
    await emitUnread(recipientId);
    // The first answer makes the conversation an exchange: from now on each may see the other's presence.
    const [counts] = await db
      .select({
        mine: sql<string>`count(*) filter (where ${directMessages.senderId} = ${senderId})`,
        theirs: sql<string>`count(*) filter (where ${directMessages.senderId} = ${recipientId})`,
      })
      .from(directMessages)
      .where(eq(directMessages.conversationId, conversationId));
    if (Number(counts?.mine) === 1 && Number(counts?.theirs) > 0) circleChanged(senderId, recipientId);
    await notifyMessage(recipientId, senderId, conversationId);
  });

  return result;
}

/**
 * Lists conversations of a user with the other participant, the last message, the unread count and — when the rules
 * allow it — the other participant's presence. Messages waiting for this account are marked delivered (the list is
 * what an app loads first).
 */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  await markAllDelivered(userId);
  const result = await db.execute<{
    id: string;
    last_message_at: Date | string;
    other_id: string;
    username: string;
    role: string;
    is_age_verified: boolean;
    display_name: string;
    avatar_url: string | null;
    lm_id: string | null;
    lm_seq: string | null;
    lm_content: string | null;
    lm_sender: string | null;
    lm_story: string | null;
    lm_created: Date | string | null;
    lm_delivered: Date | string | null;
    lm_read: boolean | null;
    unread: string;
    blocked_by_me: boolean;
  }>(sql`
    select cv.id, cv.last_message_at,
           o.id as other_id, o.username, o.role, o.is_age_verified,
           coalesce(p.display_name, o.username) as display_name, p.avatar_url,
           lm.id as lm_id, lm.seq as lm_seq, lm.content as lm_content, lm.sender_id as lm_sender, lm.story_id as lm_story,
           lm.created_at as lm_created, lm.delivered_at as lm_delivered, lm.is_read as lm_read,
           (select count(*) from direct_messages u
             where u.conversation_id = cv.id and u.recipient_id = ${userId} and u.is_read = false) as unread,
           exists (select 1 from blocked_users b where b.blocker_id = ${userId} and b.blocked_id = o.id) as blocked_by_me
      from conversations cv
      join users o on o.id = case when cv.participant1_id = ${userId} then cv.participant2_id else cv.participant1_id end
      left join profiles p on p.user_id = o.id
      left join lateral (
        select m.id, m.seq, m.content, m.sender_id, m.story_id, m.created_at, m.delivered_at, m.is_read
          from direct_messages m where m.conversation_id = cv.id order by m.seq desc limit 1
      ) lm on true
     where cv.kind = 'direct' and (cv.participant1_id = ${userId} or cv.participant2_id = ${userId})
     order by cv.last_message_at desc
     limit 200`);

  const presence = await presenceFor(userId, result.rows.map((r) => r.other_id));
  const date = (v: Date | string | null) => (v == null ? null : new Date(v));
  const direct = result.rows.map((r): ConversationSummary => ({
    id: r.id,
    kind: "direct",
    title: null,
    memberCount: 2,
    muted: false,
    lastMessageAt: new Date(r.last_message_at),
    otherUser: { id: r.other_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url, isAgeVerified: r.is_age_verified, role: r.role },
    lastMessage: r.lm_id
      ? {
          id: r.lm_id,
          seq: Number(r.lm_seq),
          content: r.lm_content ?? "",
          senderId: r.lm_sender!,
          storyId: r.lm_story,
          createdAt: date(r.lm_created)!,
          deliveredAt: date(r.lm_delivered),
          isRead: Boolean(r.lm_read),
        }
      : null,
    unreadCount: Number(r.unread),
    blockedByMe: Boolean(r.blocked_by_me),
    ...(presence[r.other_id] ? { presence: presence[r.other_id] } : {}),
  }));
  const groups = await listGroupSummaries(userId);
  return [...direct, ...groups].sort((a, b) => compareDesc(a.lastMessageAt, b.lastMessageAt));
}

/** The groups the account is in (not left): title, member count, last message, unread after its read cursor. */
async function listGroupSummaries(userId: string): Promise<ConversationSummary[]> {
  const result = await db.execute<{
    id: string;
    title: string | null;
    avatar_url: string | null;
    last_message_at: Date | string;
    muted_until: Date | string | null;
    members: string;
    lm_id: string | null;
    lm_seq: string | null;
    lm_content: string | null;
    lm_sender: string | null;
    lm_story: string | null;
    lm_created: Date | string | null;
    unread: string;
  }>(sql`
    select cv.id, cv.title, cv.avatar_url, cv.last_message_at, cm.muted_until,
           (select count(*) from conversation_members x where x.conversation_id = cv.id and x.left_at is null) as members,
           lm.id as lm_id, lm.seq as lm_seq, lm.content as lm_content, lm.sender_id as lm_sender, lm.story_id as lm_story, lm.created_at as lm_created,
           (select count(*) from direct_messages u where u.conversation_id = cv.id and u.seq > cm.last_read_seq and u.sender_id <> ${userId}) as unread
      from conversation_members cm
      join conversations cv on cv.id = cm.conversation_id and cv.kind = 'group'
      left join lateral (
        select m.id, m.seq, m.content, m.sender_id, m.story_id, m.created_at
          from direct_messages m where m.conversation_id = cv.id order by m.seq desc limit 1
      ) lm on true
     where cm.user_id = ${userId} and cm.left_at is null
     order by cv.last_message_at desc
     limit 200`);
  return result.rows.map((r) => ({
    id: r.id,
    kind: "group" as const,
    title: r.title,
    memberCount: Number(r.members),
    muted: r.muted_until !== null && new Date(r.muted_until).getTime() > Date.now(),
    lastMessageAt: new Date(r.last_message_at),
    otherUser: { id: r.id, username: "", displayName: r.title ?? "", avatarUrl: r.avatar_url, isAgeVerified: true, role: "GROUP" },
    lastMessage: r.lm_id
      ? {
          id: r.lm_id,
          seq: Number(r.lm_seq),
          content: r.lm_content ?? "",
          senderId: r.lm_sender!,
          storyId: r.lm_story,
          createdAt: new Date(r.lm_created!),
          deliveredAt: null,
          isRead: false,
        }
      : null,
    unreadCount: Number(r.unread),
    blockedByMe: false,
  }));
}

/**
 * A conversation's messages, oldest first: the latest `limit`, or the `limit` before `seq = before` (scrolling back).
 * Opening the latest page marks the messages addressed to the viewer as read.
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  options: { before?: number; limit?: number } = {},
): Promise<{ messages: MessageView[]; hasMore: boolean; names?: Record<string, string> }> {
  const access = await conversationFor(conversationId, userId);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

  if (options.before === undefined) await (access.kind === ConversationKind.Group ? markGroupRead(conversationId, userId) : markRead(conversationId, userId));

  const rows = await db
    .select()
    .from(directMessages)
    .where(and(eq(directMessages.conversationId, conversationId), options.before !== undefined ? lt(directMessages.seq, options.before) : undefined))
    .orderBy(desc(directMessages.seq))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  if (access.kind !== ConversationKind.Group) return { messages: page.map(messageView), hasMore };
  // A group shows who wrote: the display names of the page's senders (people who left included).
  const senderIds = [...new Set(page.map((r) => r.senderId))];
  const named = senderIds.length
    ? await db
        .select({ id: users.id, name: sql<string>`coalesce(${profiles.displayName}, ${users.username})` })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(inArray(users.id, senderIds))
    : [];
  return { messages: page.map(messageView), hasMore, names: Object.fromEntries(named.map((n) => [n.id, n.name])) };
}

/** Tells the sender how far their messages got in a conversation. */
function emitReceipt(senderId: string, conversationId: string, state: "delivered" | "read", upTo: number, at: Date) {
  emitUserEvent(senderId, { type: "receipt", conversationId, state, upTo, at: at.toISOString() });
}

/**
 * The viewer read a conversation (up to `seq = upTo`, everything when absent): the sender sees "read", the viewer's
 * badge goes down on every app.
 */
export async function markRead(conversationId: string, userId: string, upTo?: number): Promise<{ upTo: number | null }> {
  const now = new Date();
  const rows = await db
    .update(directMessages)
    .set({ isRead: true, readAt: now, deliveredAt: sql`coalesce(${directMessages.deliveredAt}, ${now})` })
    .where(
      and(
        eq(directMessages.conversationId, conversationId),
        eq(directMessages.recipientId, userId),
        eq(directMessages.isRead, false),
        upTo !== undefined ? lte(directMessages.seq, upTo) : undefined,
      ),
    )
    .returning({ seq: directMessages.seq, senderId: directMessages.senderId });
  if (rows.length === 0) return { upTo: null };
  const max = Math.max(...rows.map((r) => r.seq));
  emitReceipt(rows[0].senderId, conversationId, "read", max, now);
  emitUserEvent(userId, { type: "read", conversationId, upTo: max });
  await emitUnread(userId);
  return { upTo: max };
}

/**
 * A member read a group up to `seq = upTo` (everything when absent): their cursor moves forward only, their badge goes
 * down on every app. Group messages carry no per-message receipt.
 */
export async function markGroupRead(conversationId: string, userId: string, upTo?: number): Promise<{ upTo: number | null }> {
  const [row] = await db
    .update(conversationMembers)
    .set({
      lastReadSeq: sql`greatest(${conversationMembers.lastReadSeq}, ${upTo ?? sql`coalesce((select max(seq) from direct_messages where conversation_id = ${conversationId}), 0)`})`,
    })
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId), isNull(conversationMembers.leftAt)))
    .returning({ upTo: conversationMembers.lastReadSeq });
  if (!row) return { upTo: null };
  emitUserEvent(userId, { type: "read", conversationId, upTo: row.upTo });
  await emitUnread(userId);
  return { upTo: row.upTo };
}

/** One message reached one of the recipient's open apps (the stream that carried it calls this): the second tick. */
export async function markDelivered(messageId: string): Promise<void> {
  const now = new Date();
  const [row] = await db
    .update(directMessages)
    .set({ deliveredAt: now })
    .where(and(eq(directMessages.id, messageId), isNull(directMessages.deliveredAt)))
    .returning({ seq: directMessages.seq, senderId: directMessages.senderId, conversationId: directMessages.conversationId });
  if (row) emitReceipt(row.senderId, row.conversationId, "delivered", row.seq, now);
}

/** Everything waiting for the account is delivered (its app just loaded the conversations). */
export async function markAllDelivered(userId: string): Promise<void> {
  const now = new Date();
  const rows = await db
    .update(directMessages)
    .set({ deliveredAt: now })
    .where(and(eq(directMessages.recipientId, userId), isNull(directMessages.deliveredAt)))
    .returning({ seq: directMessages.seq, senderId: directMessages.senderId, conversationId: directMessages.conversationId });
  const last = new Map<string, { senderId: string; seq: number }>();
  for (const r of rows) {
    const seen = last.get(r.conversationId);
    if (!seen || r.seq > seen.seq) last.set(r.conversationId, { senderId: r.senderId, seq: r.seq });
  }
  for (const [conversationId, { senderId, seq }] of last) emitReceipt(senderId, conversationId, "delivered", seq, now);
}

/** "Is typing…" for the other participant: never stored, refused when a block stands between them. */
export async function signalTyping(conversationId: string, userId: string, typing: boolean): Promise<void> {
  const { otherId } = await conversationFor(conversationId, userId);
  if (!otherId) {
    // A group: every other member who has not left (never stored).
    const members = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(and(eq(conversationMembers.conversationId, conversationId), isNull(conversationMembers.leftAt)));
    for (const m of members) if (m.userId !== userId) emitUserEvent(m.userId, { type: "typing", conversationId, userId, typing });
    return;
  }
  const { isBlockedByOther, hasBlockedOther } = await checkBlockStatus(userId, otherId);
  if (isBlockedByOther || hasBlockedOther) return;
  emitUserEvent(otherId, { type: "typing", conversationId, userId, typing });
}

export const MESSAGE_REPORT_REASONS = ["NON_CONSENSUAL", "UNDERAGE", "TERMS_VIOLATION", "FRAUD_SCAM"] as const;

/**
 * The recipient reports a message they received: a compliance report naming it, with its text copied (the evidence
 * outlives the conversation). Never a message one sent oneself.
 */
export async function reportMessage(input: {
  conversationId: string;
  messageId: string;
  reporterId: string;
  reason: (typeof MESSAGE_REPORT_REASONS)[number];
  details?: string;
}): Promise<{ ticketId: string; reporterEmail: string; senderUsername: string; urgent: boolean; details: string }> {
  const access = await conversationFor(input.conversationId, input.reporterId);
  const [row] = await db
    .select({ id: directMessages.id, content: directMessages.content, senderId: directMessages.senderId, recipientId: directMessages.recipientId, sender: users.username })
    .from(directMessages)
    .innerJoin(users, eq(users.id, directMessages.senderId))
    .where(and(eq(directMessages.id, input.messageId), eq(directMessages.conversationId, input.conversationId)))
    .limit(1);
  // Direct: the recipient reports. Group: any member reports another member's message. Never one's own.
  if (!row || row.senderId === input.reporterId || (access.kind === ConversationKind.Direct && row.recipientId !== input.reporterId)) throw new HttpError(404, "Message not found");
  const [reporter] = await db.select({ email: users.email }).from(users).where(eq(users.id, input.reporterId)).limit(1);
  // i18n-ignore: operator-facing evidence, read in the admin console
  const details = `${input.details?.trim() || "(no details)"}\n\n--- Reported message from @${row.sender} ---\n${row.content}`.slice(0, 5000);
  const [report] = await db
    .insert(complianceReports)
    .values({
      messageId: row.id,
      videoTitle: access.kind === ConversationKind.Group ? `Group message from @${row.sender}` : `Direct message from @${row.sender}`, // i18n-ignore: operator-facing label
      reason: input.reason,
      details,
      reporterEmail: reporter.email,
      reporterId: input.reporterId,
    })
    .returning({ id: complianceReports.id });
  return { ticketId: report.id, reporterEmail: reporter.email, senderUsername: row.sender, urgent: input.reason === "UNDERAGE" || input.reason === "NON_CONSENSUAL", details };
}

// ── Blocking ────────────────────────────────────────────────────────────────────────────────────

async function targetByUsername(username: string): Promise<string> {
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.username})`, username.trim().toLowerCase()))
    .limit(1);
  if (!target) throw new HttpError(404, "User not found");
  return target.id;
}

/** A block changes who sees whom online: both accounts' streams rebuild their circle at once. */
const blockChanged = (a: string, b: string) => circleChanged(a, b);

/**
 * Blocks a user by target username.
 */
export async function blockUser(blockerId: string, targetUsername: string, reason?: string): Promise<void> {
  const targetId = await targetByUsername(targetUsername);
  if (targetId === blockerId) throw new HttpError(400, "Cannot block yourself");
  await db.insert(blockedUsers).values({ blockerId, blockedId: targetId, reason: reason?.trim() || null }).onConflictDoNothing();
  blockChanged(blockerId, targetId);
}

/**
 * Unblocks a user by target username.
 */
export async function unblockUser(blockerId: string, targetUsername: string): Promise<void> {
  const targetId = await targetByUsername(targetUsername);
  await db.delete(blockedUsers).where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, targetId)));
  blockChanged(blockerId, targetId);
}

/**
 * Toggles block state for a target user.
 */
export async function toggleBlockUser(blockerId: string, targetUsername: string, reason?: string): Promise<boolean> {
  const targetId = await targetByUsername(targetUsername);
  if (targetId === blockerId) throw new HttpError(400, "Cannot block yourself");
  const removed = await db
    .delete(blockedUsers)
    .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, targetId)))
    .returning({ id: blockedUsers.id });
  if (removed.length === 0) {
    await db.insert(blockedUsers).values({ blockerId, blockedId: targetId, reason: reason?.trim() || null }).onConflictDoNothing();
  }
  blockChanged(blockerId, targetId);
  return removed.length === 0;
}

/**
 * Lists all users blocked by the viewer.
 */
export async function listBlockedUsers(blockerId: string): Promise<{ id: string; username: string; blockedUsername: string; displayName: string; avatarUrl: string | null; blockedAt: Date }[]> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      blockedUsername: users.username,
      displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
      avatarUrl: profiles.avatarUrl,
      blockedAt: blockedUsers.createdAt,
    })
    .from(blockedUsers)
    .innerJoin(users, eq(users.id, blockedUsers.blockedId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(blockedUsers.blockerId, blockerId))
    .orderBy(desc(blockedUsers.createdAt));

  return rows;
}
