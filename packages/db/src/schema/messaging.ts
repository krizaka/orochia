import { pgTable, text, timestamp, boolean, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

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
 * Direct messages sent within a conversation.
 */
export const directMessages = pgTable(
  "direct_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    recipientId: uuid("recipient_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    conversationIdx: index("direct_messages_conversation_idx").on(table.conversationId),
    senderIdx: index("direct_messages_sender_idx").on(table.senderId),
    recipientIdx: index("direct_messages_recipient_idx").on(table.recipientId),
    createdAtIdx: index("direct_messages_created_at_idx").on(table.createdAt),
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
