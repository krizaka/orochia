import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { videos } from "./videos";
import { stories } from "./stories";
import {
  ledgerEntryTypeEnum,
  paymentGatewayEnum,
  paymentIntentStatusEnum,
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
    /** A tip sent from a story (the story it was sent from; the creator is credited like any tip). */
    storyId: uuid("story_id").references(() => stories.id, { onDelete: "set null" }),
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
    storyIdx: index("tips_ledger_story_idx").on(table.storyId),
    createdAtIdx: index("tips_ledger_created_at_idx").on(table.createdAt),
    // A gateway transaction credits a creator once, however many times its webhook is delivered.
    creditOnceIdx: uniqueIndex("tips_ledger_credit_once_idx")
      .on(table.gateway, table.gatewayTransactionRef)
      .where(sql`entry_type = 'CREATOR_CREDIT'`),
  })
);

/**
 * A payment the platform asked a gateway to collect. Everything the settlement needs — who pays,
 * who is paid, for which video, how much — is recorded here before the buyer leaves for the
 * gateway; the gateway's signed webhook only confirms that the payment happened. A webhook never
 * decides who is credited.
 */
export const paymentIntents = pgTable(
  "payment_intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gateway: paymentGatewayEnum("gateway").notNull(),
    gatewaySessionId: varchar("gateway_session_id", { length: 255 }),
    senderId: uuid("sender_id")
      .references(() => users.id, { onDelete: "set null" }),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "set null" }),
    /** A tip sent from a story: settled as a creator tip, counted on the story. */
    storyId: uuid("story_id").references(() => stories.id, { onDelete: "set null" }),
    amountCents: integer("amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    status: paymentIntentStatusEnum("status").default("PENDING").notNull(),
    gatewayTransactionRef: varchar("gateway_transaction_ref", { length: 255 }),
    ledgerId: uuid("ledger_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    senderIdx: index("payment_intents_sender_idx").on(table.senderId),
    statusIdx: index("payment_intents_status_idx").on(table.status),
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
