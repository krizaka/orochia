import { pgTable, text, timestamp, boolean, varchar, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Reference data table for content classifications & age ratings.
 * Used for tagging, age gating, blur filters, and compliance.
 */
export const contentRatings = pgTable("content_ratings", {
  id: varchar("id", { length: 30 }).primaryKey(), // FOR_KIDS, GENERAL, TEEN, MATURE, ADULT
  label: varchar("label", { length: 50 }).notNull(),
  description: text("description"),
  isAdult: boolean("is_adult").default(false).notNull(),
  requiresBlur: boolean("requires_blur").default(false).notNull(),
  defaultTags: text("default_tags").array().notNull().default(sql`'{}'::text[]`),
  minAge: integer("min_age").default(0).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  iconName: varchar("icon_name", { length: 50 }).default("shield").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
