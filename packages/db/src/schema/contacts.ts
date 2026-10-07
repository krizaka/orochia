import { pgTable, timestamp, uuid, uniqueIndex, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { contactStatusEnum, followStatusEnum } from "./enums";

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterId: uuid("requester_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    addresseeId: uuid("addressee_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: contactStatusEnum("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userPairIdx: uniqueIndex("contacts_pair_idx").on(table.requesterId, table.addresseeId),
  })
);

/**
 * Followers of a creator. A follow starts PENDING and becomes APPROVED when the creator accepts it;
 * only approved followers watch APPROVED_FOLLOWERS_ONLY videos.
 */
export const follows = pgTable(
  "follows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    followerId: uuid("follower_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: followStatusEnum("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (table) => ({
    pairIdx: uniqueIndex("follows_pair_idx").on(table.followerId, table.creatorId),
    creatorStatusIdx: index("follows_creator_status_idx").on(table.creatorId, table.status),
  })
);
