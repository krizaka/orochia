import { boolean, date, integer, jsonb, pgTable, serial, text, timestamp, unique, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * The parameters of the app-version contract (krizaka/.github#75, `@krizaka/app-config`), one row per platform: the
 * minimum version, the latest, a forced/soft override, the store URL, maintenance, the API contract range and the
 * feature flags. Seeded permissive (nobody is blocked); an operator publishes the real values, never by hand-editing.
 */
export const appConfig = pgTable("app_config", {
  platform: varchar("platform", { length: 16 }).primaryKey(),
  minSupportedVersion: varchar("min_supported_version", { length: 32 }).default("0.0.0").notNull(),
  latestVersion: varchar("latest_version", { length: 32 }).default("0.0.0").notNull(),
  updateOverride: varchar("update_override", { length: 8 }),
  storeUrl: text("store_url"),
  maintenanceOn: boolean("maintenance_on").default(false).notNull(),
  maintenanceMessage: jsonb("maintenance_message").default(sql`'{}'::jsonb`).notNull(),
  message: jsonb("message").default(sql`'{}'::jsonb`).notNull(),
  contractMin: integer("contract_min").default(1).notNull(),
  contractMax: integer("contract_max").default(1).notNull(),
  contractSunset: date("contract_sunset"),
  flags: jsonb("flags").default(sql`'{}'::jsonb`).notNull(),
  revision: integer("revision").default(1).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: varchar("updated_by", { length: 255 }).default("seed").notNull(),
});

/** Every published revision, append-only: the audit trail and the source of a rollback. */
export const appConfigHistory = pgTable(
  "app_config_history",
  {
    id: serial("id").primaryKey(),
    platform: varchar("platform", { length: 16 }).notNull(),
    revision: integer("revision").notNull(),
    minSupportedVersion: varchar("min_supported_version", { length: 32 }).notNull(),
    latestVersion: varchar("latest_version", { length: 32 }).notNull(),
    updateOverride: varchar("update_override", { length: 8 }),
    storeUrl: text("store_url"),
    maintenanceOn: boolean("maintenance_on").notNull(),
    maintenanceMessage: jsonb("maintenance_message").notNull(),
    message: jsonb("message").notNull(),
    contractMin: integer("contract_min").notNull(),
    contractMax: integer("contract_max").notNull(),
    contractSunset: date("contract_sunset"),
    flags: jsonb("flags").notNull(),
    reason: text("reason").notNull(),
    changedBy: varchar("changed_by", { length: 255 }).notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({ revisionUnique: unique("app_config_history_revision").on(table.platform, table.revision) })
);
