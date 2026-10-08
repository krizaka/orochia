import { pgTable, timestamp, uuid, varchar, index } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Invitations sent by users to invite friends and collaborators to join the platform.
 */
export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inviterId: uuid("inviter_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    status: varchar("status", { length: 20 }).default("PENDING").notNull(), // 'PENDING' | 'ACCEPTED' | 'EXPIRED'
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    inviterIdx: index("user_invitations_inviter_idx").on(table.inviterId),
    emailIdx: index("user_invitations_email_idx").on(table.email),
    codeIdx: index("user_invitations_code_idx").on(table.code),
  })
);
