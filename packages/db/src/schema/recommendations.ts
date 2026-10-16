import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Recommendations served by Orazaka (ADR-078, krizaka/orochia#226). Orochia provides the data, Orazaka analyses:
 *
 * - `reco_outbox` — interaction events and erasures, written in the same transaction as the action they describe and
 *   drained to Orazaka by a background loop (at least once; Orazaka ignores a known id). The person is a **pseudonym**
 *   (HMAC of the account id with `AI_PSEUDONYM_KEY`): the outbox never holds an account id, an e-mail or a name.
 * - `reco_item_sync` — which discoverable videos Orazaka holds, and the hash of the text it embedded: a reconciler sends
 *   the changed ones and erases the ones that left discovery. No foreign key on purpose: a deleted video must still be
 *   erased at Orazaka.
 * - `app_settings` — versioned parameters (a new version is a new row with its reason; the newest one is read). The
 *   recommendations domain's version 1 is seeded by the migration, switched off.
 */

/** What an outbox row carries: one event, or an erasure (people or items to forget). */
export const recoOutboxKindEnum = pgEnum("reco_outbox_kind", ["EVENT", "ERASURE"]);

export const recoOutbox = pgTable(
  "reco_outbox",
  {
    /** Also the event's idempotency key at Orazaka. */
    id: uuid("id").defaultRandom().primaryKey(),
    /** A natural key when the same fact may be enqueued twice (a settlement notified twice): one row. */
    dedupKey: varchar("dedup_key", { length: 120 }),
    kind: recoOutboxKindEnum("kind").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** The failure code of the last attempt (not_configured · circuit_open · unreachable · refused · bad_response). */
    lastError: varchar("last_error", { length: 40 }),
  },
  (table) => ({
    dedupIdx: uniqueIndex("reco_outbox_dedup_idx").on(table.dedupKey),
    pendingIdx: index("reco_outbox_pending_idx").on(table.nextAttemptAt).where(sql`${table.sentAt} is null`),
    sentIdx: index("reco_outbox_sent_idx").on(table.sentAt),
  }),
);

export const recoItemSync = pgTable("reco_item_sync", {
  videoId: uuid("video_id").primaryKey(),
  contentHash: varchar("content_hash", { length: 64 }).notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

export const appSettings = pgTable(
  "app_settings",
  {
    domain: varchar("domain", { length: 40 }).notNull(),
    version: integer("version").notNull(),
    settings: jsonb("settings").notNull(),
    reason: text("reason").notNull(),
    createdBy: varchar("created_by", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.domain, table.version] }),
  }),
);
