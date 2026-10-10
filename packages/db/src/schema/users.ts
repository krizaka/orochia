import { pgTable, text, timestamp, boolean, uuid, varchar, integer, date, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { userRoleEnum } from "./enums";
import { searchVectorOf, tsvector } from "./search";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("MEMBER").notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  isAgeVerified: boolean("is_age_verified").default(false).notNull(), // Mandatory 18+ verification flag
  /** Declared at sign-up and checked 18+ by the server (lib/profile.ts). Private: never shown to others. */
  dateOfBirth: date("date_of_birth"),
  /** Set when the owner of the address followed the verification link; until then the account can only sign in and ask for the link again. */
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  /** Set by an administrator: a suspended account can neither sign in nor publish. */
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspensionReason: text("suspension_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  displayName: varchar("display_name", { length: 100 }),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  websiteUrl: text("website_url"),
  /** Handles on other networks (instagram, x, facebook, tiktok, youtube, telegram); URLs are built by the server. */
  socialLinks: jsonb("social_links").$type<Record<string, string>>().default(sql`'{}'::jsonb`).notNull(),
  /** Activity e-mails turned off, by event (absent = on: everything is on by default). */
  emailsOff: jsonb("notifications_off").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  /** In-app notifications (the bell) turned off, by event. */
  inAppOff: jsonb("in_app_off").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  /** How many activity e-mails: INSTANT (each one), HOURLY (at most one an hour), NONE. */
  emailFrequency: varchar("email_frequency", { length: 10 }).default("INSTANT").notNull(),
  lastActivityEmailAt: timestamp("last_activity_email_at", { withTimezone: true }),
  directMessagePrivacy: varchar("direct_message_privacy", { length: 20 }).default("EVERYONE").notNull(),
  minTipAmountCents: integer("min_tip_amount_cents").default(500).notNull(), // default $5.00
  /** Challenges: whether fans may send this creator requests, and the smallest offer a request may carry. */
  challengeRequestsOff: boolean("challenge_requests_off").default(false).notNull(),
  challengeMinCents: integer("challenge_min_cents").default(1000).notNull(), // default $10.00
  payoutAddressCrypto: text("payout_address_crypto"),
  payoutAccountCcbill: varchar("payout_account_ccbill", { length: 100 }),
  totalViews: integer("total_views").default(0).notNull(),
  totalTipsEarnedCents: integer("total_tips_earned_cents").default(0).notNull(),
  /** Full-text search over the display name (weight A) and the bio (B), generated (see search.ts). */
  searchVector: tsvector("search_vector").generatedAlwaysAs(searchVectorOf(sql`"display_name"`, null, sql`"bio"`)),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  searchIdx: index("profiles_search_idx").using("gin", table.searchVector),
}));
