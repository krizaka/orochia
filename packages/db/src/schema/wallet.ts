import { pgTable, text, timestamp, uuid, varchar, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { paymentGatewayEnum, paymentIntentStatusEnum, walletEntryTypeEnum } from "./enums";

/**
 * Orochia credits. A top-up is bought through a gateway's hosted checkout (card, Apple Pay, Google Pay… — card numbers
 * never reach Orochia) and settled by its signed webhook, exactly once; credits are then spent on tips and unlocks.
 * 1 credit = 1 US cent. The balance is the sum of the account's wallet_ledger rows: append-only, never updated.
 */
export const creditTopups = pgTable(
  "credit_topups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    /** Credits added on success (cents of value). */
    creditsCents: integer("credits_cents").notNull(),
    /** What the buyer pays. */
    priceCents: integer("price_cents").notNull(),
    gateway: paymentGatewayEnum("gateway").notNull(),
    status: paymentIntentStatusEnum("status").default("PENDING").notNull(),
    gatewayTransactionRef: varchar("gateway_transaction_ref", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (table) => ({
    userIdx: index("credit_topups_user_idx").on(table.userId, table.createdAt),
  })
);

export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    entryType: walletEntryTypeEnum("entry_type").notNull(),
    /** Signed: + for top-ups and refunds, − for spending. */
    amountCents: integer("amount_cents").notNull(),
    /** Unique per movement (topup_<id>, spend_<intent>, refund_<intent>): a movement is written once. */
    reference: varchar("reference", { length: 120 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("wallet_ledger_user_idx").on(table.userId, table.createdAt),
    referenceIdx: uniqueIndex("wallet_ledger_reference_idx").on(table.reference),
  })
);

/**
 * Where a creator's earnings are sent. The details (IBAN, routing and account numbers, PayPal address, wallet
 * address) are encrypted at rest (AES-256-GCM, PAYOUT_ENCRYPTION_KEY); the app only ever shows `display_hint`
 * (e.g. "IBAN •••• 4321"). One account per creator; changing it replaces it.
 */
export const payoutAccounts = pgTable("payout_accounts", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .primaryKey(),
  method: varchar("method", { length: 30 }).notNull(),
  holderName: varchar("holder_name", { length: 120 }).notNull(),
  country: varchar("country", { length: 2 }).notNull(),
  detailsEncrypted: text("details_encrypted").notNull(),
  displayHint: varchar("display_hint", { length: 80 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
