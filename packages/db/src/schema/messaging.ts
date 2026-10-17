import { pgTable, text, timestamp, boolean, uuid, index, uniqueIndex, bigserial } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { stories } from "./stories";

/**
 * Direct messaging conversation thread between two users.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    participant1Id: uuid("participant1_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    participant2Id: uuid("participant2_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    participant1Idx: index("conversations_participant1_idx").on(table.participant1Id),
    participant2Idx: index("conversations_participant2_idx").on(table.participant2Id),
    lastMessageAtIdx: index("conversations_last_message_at_idx").on(table.lastMessageAt),
  })
);

/**
 * Direct messages sent within a conversation. `seq` is the delivery order (assigned under the conversation's row lock,
 * so a conversation's messages commit in that order) and the replay cursor of the realtime stream; `client_id` is the
 * sender's idempotency key (a retried send never makes a second message). Receipts: sent (the row) → delivered
 * (`delivered_at`: one of the recipient's apps received it) → read (`is_read` / `read_at`).
 */
export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seq: bigserial("seq", { mode: "number" }).notNull(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    /** Chosen by the sender's app for this message: a retry with the same id answers the message already stored. */
    clientId: uuid("client_id"),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    recipientId: uuid("recipient_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    /** A private reply to a story: the story it answers (the message stays when the story is gone). */
    storyId: uuid("story_id").references(() => stories.id, { onDelete: "set null" }),
    /** `human` or `ai_assisted` (a reply drafted by an assistant: shown with its disclosure; apps/web/lib/message-origin.ts). */
    origin: text("origin").default("human").notNull(),
    /** When one of the recipient's apps received it (the second tick). */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("direct_messages_conversation_idx").on(table.conversationId),
    senderIdx: index("direct_messages_sender_idx").on(table.senderId),
    recipientIdx: index("direct_messages_recipient_idx").on(table.recipientId),
    createdAtIdx: index("direct_messages_created_at_idx").on(table.createdAt),
    seqIdx: uniqueIndex("direct_messages_seq_idx").on(table.seq),
    conversationSeqIdx: index("direct_messages_conversation_seq_idx").on(table.conversationId, table.seq),
    clientIdIdx: uniqueIndex("direct_messages_sender_client_idx").on(table.senderId, table.clientId),
    unreadIdx: index("direct_messages_unread_idx").on(table.recipientId).where(sql`${table.isRead} = false`),
  })
);

/**
 * Blocked users table: allows a user to block another user from messaging them or viewing contact content.
 */
export const blockedUsers = pgTable(
  "blocked_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    blockerId: uuid("blocker_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    blockedId: uuid("blocked_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    blockerBlockedUniqueIdx: uniqueIndex("blocked_users_pair_idx").on(table.blockerId, table.blockedId),
    blockerIdx: index("blocked_users_blocker_idx").on(table.blockerId),
    blockedIdx: index("blocked_users_blocked_idx").on(table.blockedId),
  })
);
