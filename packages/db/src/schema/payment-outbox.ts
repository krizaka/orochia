import { pgTable, text, timestamp, integer, uuid, varchar, index } from "drizzle-orm/pg-core";

/**
 * Transactional Outbox pattern table for payment operations and background jobs.
 * Ensures reliable, asynchronous event delivery and queueing for high traffic payment settlements.
 */
export const paymentOutbox = pgTable(
  "payment_outbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    payload: text("payload").notNull(),
    status: varchar("status", { length: 20 }).default("PENDING").notNull(), // 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
    attempts: integer("attempts").default(0).notNull(),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => ({
    statusNextAttemptIdx: index("payment_outbox_status_attempt_idx").on(table.status, table.nextAttemptAt),
    createdAtIdx: index("payment_outbox_created_at_idx").on(table.createdAt),
  })
);
