import { pgTable, text, timestamp, boolean, uuid, varchar, integer } from "drizzle-orm/pg-core";
import { userRoleEnum } from "./enums";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").default("MEMBER").notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  isAgeVerified: boolean("is_age_verified").default(false).notNull(), // Mandatory 18+ verification flag
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
  twitterHandle: varchar("twitter_handle", { length: 100 }),
  directMessagePrivacy: varchar("direct_message_privacy", { length: 20 }).default("EVERYONE").notNull(),
  minTipAmountCents: integer("min_tip_amount_cents").default(500).notNull(), // default $5.00
  payoutAddressCrypto: text("payout_address_crypto"),
  payoutAccountCcbill: varchar("payout_account_ccbill", { length: 100 }),
  totalViews: integer("total_views").default(0).notNull(),
  totalTipsEarnedCents: integer("total_tips_earned_cents").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
