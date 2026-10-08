import { pgTable, timestamp, uuid, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { authTokenPurposeEnum } from "./enums";

/**
 * One-time links sent by e-mail (verify the address, reset the password). Only the SHA-256 of the
 * token is stored; a token works once, before it expires, for the purpose it was issued for.
 */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    purpose: authTokenPurposeEnum("purpose").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("auth_tokens_hash_idx").on(table.tokenHash),
    userPurposeIdx: index("auth_tokens_user_purpose_idx").on(table.userId, table.purpose),
  })
);
