import { pgTable, text, timestamp, boolean, uuid, index, uniqueIndex, bigserial, bigint, integer, primaryKey, check } from "drizzle-orm/pg-core";
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
    /** `direct` (two people; `participant1/2` set) or `group` (members in `conversation_members`; both null). */
    kind: text("kind").default("direct").notNull(),
    participant1Id: uuid("participant1_id").references(() => users.id, { onDelete: "cascade" }),
    participant2Id: uuid("participant2_id").references(() => users.id, { onDelete: "cascade" }),
    /** A group's name, picture and creator. */
    title: text("title"),
    avatarUrl: text("avatar_url"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    /** A closed group: nobody writes, members still read. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    participant1Idx: index("conversations_participant1_idx").on(table.participant1Id),
    participant2Idx: index("conversations_participant2_idx").on(table.participant2Id),
    lastMessageAtIdx: index("conversations_last_message_at_idx").on(table.lastMessageAt),
    kindShape: check("conversations_kind_shape_check", sql`${table.kind} in ('direct', 'group') and (${table.kind} = 'group' or (${table.participant1Id} is not null and ${table.participant2Id} is not null))`),
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
    /** The other person of a direct conversation; null in a group (its readers are the members, read through their cursor). */
    recipientId: uuid("recipient_id").references(() => users.id, { onDelete: "cascade" }),
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

/**
 * Who takes part in a conversation (every conversation, direct or group). Authorisation starts here: a non-member gets
 * 404. In a group, `last_read_seq` is the read cursor (unread = messages after it, not mine); a direct conversation
 * keeps its receipts on the messages. A member who left stays as a row with `left_at`.
 */
export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** `owner` or `member`. */
    role: text("role").default("member").notNull(),
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    lastReadSeq: bigint("last_read_seq", { mode: "number" }).default(0).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
    userIdx: index("conversation_members_user_idx").on(table.userId).where(sql`${table.leftAt} is null`),
  })
);

/** A group's invite link: only the hash of the token is stored; it expires and can be revoked. */
export const conversationInvites = pgTable(
  "conversation_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: text("token_hash").notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    maxUses: integer("max_uses").default(50).notNull(),
    uses: integer("uses").default(0).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("conversation_invites_token_idx").on(table.tokenHash),
    conversationIdx: index("conversation_invites_conversation_idx").on(table.conversationId),
  })
);
