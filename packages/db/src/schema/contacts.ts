import { pgTable, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { contactStatusEnum } from "./enums";

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
