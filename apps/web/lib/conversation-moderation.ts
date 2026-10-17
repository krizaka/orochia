import { complianceReports, conversationMembers, conversations, db, directMessages, users } from "@orochia/db";
import { and, asc, between, eq, isNull, sql } from "drizzle-orm";

import { contextRange } from "./conversation-moderation-rules";
import { HttpError } from "./http";
import { emitUnread, emitUserEvent } from "./messaging";

/**
 * The reported message with its neighbours (±10 by `seq`), the conversation's kind and title: what an operator reads to
 * decide. Anything else of the conversation stays unread.
 */
export async function reportContext(reportId: string) {
  const [report] = await db.select({ id: complianceReports.id, messageId: complianceReports.messageId, reason: complianceReports.reason }).from(complianceReports).where(eq(complianceReports.id, reportId)).limit(1);
  if (!report) throw new HttpError(404, "Report not found");
  if (!report.messageId) throw new HttpError(404, "The reported message no longer exists (the report keeps its copy)");
  const [message] = await db.select({ id: directMessages.id, seq: directMessages.seq, conversationId: directMessages.conversationId }).from(directMessages).where(eq(directMessages.id, report.messageId)).limit(1);
  if (!message) throw new HttpError(404, "The reported message no longer exists (the report keeps its copy)");
  const { from, to } = contextRange(message.seq);
  const rows = await db
    .select({
      id: directMessages.id,
      seq: directMessages.seq,
      senderId: directMessages.senderId,
      sender: users.username,
      content: directMessages.content,
      createdAt: directMessages.createdAt,
    })
    .from(directMessages)
    .innerJoin(users, eq(users.id, directMessages.senderId))
    .where(and(eq(directMessages.conversationId, message.conversationId), between(directMessages.seq, from, to)))
    .orderBy(asc(directMessages.seq));
  const [conversation] = await db
    .select({ id: conversations.id, kind: conversations.kind, title: conversations.title, archivedAt: conversations.archivedAt })
    .from(conversations)
    .where(eq(conversations.id, message.conversationId))
    .limit(1);
  const [{ n }] = await db
    .select({ n: sql<string>`count(*)` })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, message.conversationId), isNull(conversationMembers.leftAt)));
  return { reportId: report.id, reason: report.reason, conversation: { ...conversation, members: Number(n) }, reportedMessageId: message.id, messages: rows };
}

export type ModerationInput = { conversationId: string } & ({ action: "remove_message"; messageId: string } | { action: "remove_member"; userId: string } | { action: "archive" });

/** An operator acts on a conversation: remove a message (the reports keep their copy), remove a member, or close a group. */
export async function moderateConversation(input: ModerationInput): Promise<void> {
  const [conversation] = await db.select({ id: conversations.id, kind: conversations.kind }).from(conversations).where(eq(conversations.id, input.conversationId)).limit(1);
  if (!conversation) throw new HttpError(404, "Conversation not found");
  if (input.action === "remove_message") {
    const removed = await db
      .delete(directMessages)
      .where(and(eq(directMessages.id, input.messageId), eq(directMessages.conversationId, input.conversationId)))
      .returning({ id: directMessages.id });
    if (removed.length === 0) throw new HttpError(404, "Message not found");
  } else if (conversation.kind !== "group") {
    throw new HttpError(409, "Only a group can be moderated this way", { code: "NOT_A_GROUP" });
  } else if (input.action === "remove_member") {
    const removed = await db
      .update(conversationMembers)
      .set({ leftAt: new Date(), role: "member" })
      .where(and(eq(conversationMembers.conversationId, input.conversationId), eq(conversationMembers.userId, input.userId), isNull(conversationMembers.leftAt)))
      .returning({ userId: conversationMembers.userId });
    if (removed.length === 0) throw new HttpError(404, "Member not found");
    emitUserEvent(input.userId, { type: "conversation_changed", conversationId: input.conversationId });
    await emitUnread(input.userId);
  } else {
    await db.update(conversations).set({ archivedAt: new Date() }).where(eq(conversations.id, input.conversationId));
  }
  const members = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, input.conversationId), isNull(conversationMembers.leftAt)));
  for (const m of members) emitUserEvent(m.userId, { type: "conversation_changed", conversationId: input.conversationId });
}

