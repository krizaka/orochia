import { pgTable, timestamp, integer, varchar, bigint, jsonb, uuid, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Rate-limit windows shared by every instance (RATE_LIMIT_STORE=postgres, apps/web/lib/rate-limit.ts): one row per
 * key and fixed window, counted with a single upsert. Expired rows are swept by the background loop.
 */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: varchar("key", { length: 200 }).primaryKey(),
    count: integer("count").default(0).notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    resetAtIdx: index("rate_limit_buckets_reset_at_idx").on(table.resetAt),
  })
);

/**
 * Platform storage alerts already sent (one row per threshold crossed, e.g. 80 and 95 %): operators are told once per
 * crossing; the row is removed when usage falls back under the threshold, so the next crossing alerts again.
 */
export const storageAlerts = pgTable("storage_alerts", {
  threshold: integer("threshold").primaryKey(),
  alertedAt: timestamp("alerted_at", { withTimezone: true }).defaultNow().notNull(),
  usedBytes: bigint("used_bytes", { mode: "number" }).notNull(),
  limitBytes: bigint("limit_bytes", { mode: "number" }).notNull(),
});

/**
 * What Bunny said at each reconciliation (`npm run quota:reconcile`, the background loop, the admin API): the library's
 * size and count, the storage zone's when the account API key is set, and the drift with the application's counters.
 * `orphanBytes` (videos at Bunny no row knows) count in the platform's usage until the next reconciliation.
 */
export const storageSnapshots = pgTable(
  "storage_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    takenAt: timestamp("taken_at", { withTimezone: true }).defaultNow().notNull(),
    libraryBytes: bigint("library_bytes", { mode: "number" }).notNull(),
    libraryVideos: integer("library_videos").notNull(),
    librarySeconds: integer("library_seconds").default(0).notNull(),
    zoneBytes: bigint("zone_bytes", { mode: "number" }),
    zoneFiles: integer("zone_files"),
    appBytes: bigint("app_bytes", { mode: "number" }).notNull(),
    orphanBytes: bigint("orphan_bytes", { mode: "number" }).default(0).notNull(),
    orphanVideos: integer("orphan_videos").default(0).notNull(),
    missingVideos: integer("missing_videos").default(0).notNull(),
    updatedRows: integer("updated_rows").default(0).notNull(),
    details: jsonb("details").default(sql`'{}'::jsonb`).notNull(),
  },
  (table) => ({
    takenAtIdx: index("storage_snapshots_taken_at_idx").on(table.takenAt),
  })
);
