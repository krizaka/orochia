import { pgTable, timestamp, uuid, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * The phones an account receives push notifications on: one row per Expo push token (the app registers it after
 * sign-in and removes it at sign-out). A token belongs to one account at a time — signing in with another account on
 * the same phone moves it. Tokens the push service reports as dead are deleted.
 */
export const pushDevices = pgTable(
  "push_devices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    platform: varchar("platform", { length: 10 }).notNull(), // 'ios' | 'android'
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("push_devices_token_idx").on(table.token),
    userIdx: index("push_devices_user_idx").on(table.userId),
  })
);
