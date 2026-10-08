import { pgTable, timestamp, uuid, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { authProviderEnum } from "./enums";

/**
 * Accounts linked to a sign-in provider (Google, Facebook). The provider's own user id is the key: a
 * changed e-mail at the provider still signs into the same account. One account can link several.
 */
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    provider: authProviderEnum("provider").notNull(),
    providerUserId: varchar("provider_user_id", { length: 191 }).notNull(),
    email: varchar("email", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerUserIdx: uniqueIndex("auth_identities_provider_user_idx").on(table.provider, table.providerUserId),
    userIdx: index("auth_identities_user_idx").on(table.userId),
  })
);
