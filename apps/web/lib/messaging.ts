import { db, conversations, directMessages, blockedUsers, users, profiles, contacts } from "@orochia/db";
import { and, desc, eq, gt, or, sql, isNull } from "drizzle-orm";
import { HttpError } from "./http";
import { after } from "next/server";
import { notifyMessage } from "./notifications";
import { publish } from "./realtime";

/** Pushes an event to one account's open streams, on every app instance (lib/realtime.ts). */
export function emitUserEvent(userId: string, event: Record<string, unknown>): void {
  void publish(`user:${userId}`, event);
}

export interface ConversationSummary {
  id: string;
  lastMessageAt: Date;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isAgeVerified: boolean;
    role: string;
  };
  lastMessage?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: Date;
    isRead: boolean;
  } | null;
  unreadCount: number;
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Retrieves an existing conversation between two users or creates one if it doesn't exist.
 */
export async function getOrCreateConversation(userAId: string, userBId: string): Promise<string> {
  if (userAId === userBId) {
    throw new HttpError(400, "Cannot start a conversation with yourself");
  }

  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      or(
        and(eq(conversations.participant1Id, userAId), eq(conversations.participant2Id, userBId)),
        and(eq(conversations.participant1Id, userBId), eq(conversations.participant2Id, userAId))
      )
    )
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(conversations)
    .values({
      participant1Id: userAId,
      participant2Id: userBId,
      lastMessageAt: new Date(),
    })
    .returning({ id: conversations.id });

  return created.id;
}

/**
 * Checks whether userA is blocked by userB or has blocked userB.
 */
export async function checkBlockStatus(userAId: string, userBId: string): Promise<{ isBlockedByOther: boolean; hasBlockedOther: boolean }> {
  const [blockedByOther] = await db
    .select({ id: blockedUsers.id })
    .from(blockedUsers)
    .where(and(eq(blockedUsers.blockerId, userBId), eq(blockedUsers.blockedId, userAId)))
    .limit(1);

  const [hasBlockedOther] = await db
    .select({ id: blockedUsers.id })
    .from(blockedUsers)
    .where(and(eq(blockedUsers.blockerId, userAId), eq(blockedUsers.blockedId, userBId)))
    .limit(1);

  return {
    isBlockedByOther: Boolean(blockedByOther),
    hasBlockedOther: Boolean(hasBlockedOther),
  };
}

/**
 * Sends a direct message from sender to recipient.
 * Validates blocking rules, privacy preferences, and triggers realtime delivery.
 */
export async function sendMessage(senderId: string, recipientId: string, text: string): Promise<MessageView> {
  const content = text.trim();
  if (!content) {
    throw new HttpError(400, "Message cannot be empty");
  }
  if (content.length > 4000) {
    throw new HttpError(400, "Message exceeds 4000 characters limit");
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
    throw new HttpError(403, "You cannot send messages to this user");
  }
  if (hasBlockedOther) {
    throw new HttpError(403, "You must unblock this user before sending a message");
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
      throw new HttpError(403, "This user only accepts messages from mutual contacts");
    }
  }

  // 4. Record message and update conversation
  const conversationId = await getOrCreateConversation(senderId, recipientId);

  const [message] = await db
    .insert(directMessages)
    .values({
      conversationId,
      senderId,
      recipientId,
      content,
      isRead: false,
    })
    .returning();

  await db
    .update(conversations)
    .set({
      lastMessageAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversationId));

  const result: MessageView = {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    recipientId: message.recipientId,
    content: message.content,
    isRead: message.isRead,
    readAt: message.readAt,
    createdAt: message.createdAt,
  };

  // 5. Emit realtime events
  emitUserEvent(recipientId, {
    type: "new_message",
    message: result,
  });
  emitUserEvent(senderId, {
    type: "message_sent",
    message: result,
  });
  // E-mail at most once per conversation and hour (lib/notifications.ts).
  after(() => notifyMessage(recipientId, senderId, conversationId));

  return result;
}

/**
 * Lists conversations of a user with other user profile and unread message counts.
 */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  const convList = await db
    .select({
      id: conversations.id,
      participant1Id: conversations.participant1Id,
      participant2Id: conversations.participant2Id,
      lastMessageAt: conversations.lastMessageAt,
    })
    .from(conversations)
    .where(or(eq(conversations.participant1Id, userId), eq(conversations.participant2Id, userId)))
    .orderBy(desc(conversations.lastMessageAt));

  const results: ConversationSummary[] = [];

  for (const conv of convList) {
    const otherId = conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;

    const [other] = await db
      .select({
        id: users.id,
        username: users.username,
        role: users.role,
        isAgeVerified: users.isAgeVerified,
        displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
        avatarUrl: profiles.avatarUrl,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(users.id, otherId))
      .limit(1);

    if (!other) continue;

    const [lastMsg] = await db
      .select({
        id: directMessages.id,
        content: directMessages.content,
        senderId: directMessages.senderId,
        createdAt: directMessages.createdAt,
        isRead: directMessages.isRead,
      })
      .from(directMessages)
      .where(eq(directMessages.conversationId, conv.id))
      .orderBy(desc(directMessages.createdAt))
      .limit(1);

    const [unread] = await db
      .select({ count: sql<string>`count(*)` })
      .from(directMessages)
      .where(
        and(
          eq(directMessages.conversationId, conv.id),
          eq(directMessages.recipientId, userId),
          eq(directMessages.isRead, false)
        )
      );

    results.push({
      id: conv.id,
      lastMessageAt: conv.lastMessageAt,
      otherUser: other,
      lastMessage: lastMsg ?? null,
      unreadCount: Number(unread?.count ?? 0),
    });
  }

  return results;
}

/**
 * Fetches message history of a conversation and marks unread messages as read.
 */
export async function getConversationMessages(
  conversationId: string,
  userId: string,
  limit = 50
): Promise<MessageView[]> {
  const [conv] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        or(eq(conversations.participant1Id, userId), eq(conversations.participant2Id, userId))
      )
    )
    .limit(1);

  if (!conv) {
    throw new HttpError(404, "Conversation not found");
  }

  // Mark unread messages addressed to viewer as read
  await db
    .update(directMessages)
    .set({ isRead: true, readAt: new Date() })
    .where(
      and(
        eq(directMessages.conversationId, conversationId),
        eq(directMessages.recipientId, userId),
        eq(directMessages.isRead, false)
      )
    );

  const rows = await db
    .select()
    .from(directMessages)
    .where(eq(directMessages.conversationId, conversationId))
    .orderBy(desc(directMessages.createdAt))
    .limit(limit);

  return rows.reverse().map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    senderId: r.senderId,
    recipientId: r.recipientId,
    content: r.content,
    isRead: r.isRead,
    readAt: r.readAt,
    createdAt: r.createdAt,
  }));
}

/**
 * Blocks a user by target username.
 */
export async function blockUser(blockerId: string, targetUsername: string, reason?: string): Promise<void> {
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.username})`, targetUsername.trim().toLowerCase()))
    .limit(1);

  if (!target) throw new HttpError(404, "User not found");
  if (target.id === blockerId) throw new HttpError(400, "Cannot block yourself");

  await db
    .insert(blockedUsers)
    .values({
      blockerId,
      blockedId: target.id,
      reason: reason?.trim() || null,
    })
    .onConflictDoNothing();
}

/**
 * Unblocks a user by target username.
 */
export async function unblockUser(blockerId: string, targetUsername: string): Promise<void> {
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.username})`, targetUsername.trim().toLowerCase()))
    .limit(1);

  if (!target) throw new HttpError(404, "User not found");

  await db
    .delete(blockedUsers)
    .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, target.id)));
}

/**
 * Toggles block state for a target user.
 */
export async function toggleBlockUser(blockerId: string, targetUsername: string, reason?: string): Promise<boolean> {
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.username})`, targetUsername.trim().toLowerCase()))
    .limit(1);

  if (!target) throw new HttpError(404, "User not found");
  if (target.id === blockerId) throw new HttpError(400, "Cannot block yourself");

  const [existing] = await db
    .select({ blockerId: blockedUsers.blockerId })
    .from(blockedUsers)
    .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, target.id)))
    .limit(1);

  if (existing) {
    await db
      .delete(blockedUsers)
      .where(and(eq(blockedUsers.blockerId, blockerId), eq(blockedUsers.blockedId, target.id)));
    return false;
  } else {
    await db
      .insert(blockedUsers)
      .values({
        blockerId,
        blockedId: target.id,
        reason: reason?.trim() || null,
      })
      .onConflictDoNothing();
    return true;
  }
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
