import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { videos } from "./videos";
import {
  ledgerEntryTypeEnum,
  paymentGatewayEnum,
  payoutStatusEnum,
} from "./enums";

export const tipsLedger = pgTable(
  "tips_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entryType: ledgerEntryTypeEnum("entry_type").notNull(),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "set null" }),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "set null" }),
    grossAmountCents: integer("gross_amount_cents").notNull(),
    platformFeeCents: integer("platform_fee_cents").default(0).notNull(),
    netAmountCents: integer("net_amount_cents").notNull(),
    gateway: paymentGatewayEnum("gateway").notNull(),
    gatewayTransactionRef: varchar("gateway_transaction_ref", { length: 255 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("tips_ledger_creator_idx").on(table.creatorId),
    senderIdx: index("tips_ledger_sender_idx").on(table.senderId),
    videoIdx: index("tips_ledger_video_idx").on(table.videoId),
    createdAtIdx: index("tips_ledger_created_at_idx").on(table.createdAt),
  })
);

export const payoutRequests = pgTable(
  "payout_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: payoutStatusEnum("status").default("REQUESTED").notNull(),
    payoutMethod: varchar("payout_method", { length: 50 }).notNull(), // e.g. "CRYPTO_USDT", "CCBILL_DIRECT"
    payoutDestination: text("payout_destination").notNull(),
    txHashOrReference: text("tx_hash_or_reference"),
    failureReason: text("failure_reason"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    creatorStatusIdx: index("payout_requests_creator_status_idx").on(table.creatorId, table.status),
  })
);
