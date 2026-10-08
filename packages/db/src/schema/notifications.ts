import { pgTable, timestamp, uuid, varchar, jsonb, index, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * In-app notifications (the bell): one row per event and recipient, written after the action it reports.
 * `vars` fills the message of `event` (messages/en.json → notify.<event>); `path` is where it leads on the site.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    event: varchar("event", { length: 40 }).notNull(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    vars: jsonb("vars").$type<Record<string, string | number>>().default(sql`'{}'::jsonb`).notNull(),
    path: text("path").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("notifications_user_created_idx").on(table.userId, table.createdAt),
    unreadIdx: index("notifications_unread_idx").on(table.userId).where(sql`read_at is null`),
  })
);
