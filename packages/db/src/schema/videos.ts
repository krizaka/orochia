import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  integer,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { contentRatings } from "./reference-data";
import { videoVisibilityEnum, videoStatusEnum } from "./enums";

export const videos = pgTable(
  "videos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    bunnyVideoId: varchar("bunny_video_id", { length: 120 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    visibility: videoVisibilityEnum("visibility").default("PUBLIC").notNull(),
    status: videoStatusEnum("status").default("PENDING_UPLOAD").notNull(),
    minTipAmountCents: integer("min_tip_amount_cents").default(0).notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    thumbnailUrl: text("thumbnail_url"),
    previewAnimationUrl: text("preview_animation_url"),
    viewsCount: integer("views_count").default(0).notNull(),
    tipsCount: integer("tips_count").default(0).notNull(),
    /** Counters kept in step with video_views / video_likes / video_comments / video_shares. */
    likesCount: integer("likes_count").default(0).notNull(),
    commentsCount: integer("comments_count").default(0).notNull(),
    sharesCount: integer("shares_count").default(0).notNull(),
    /** The creator can close the discussion; existing comments stay readable. */
    commentsEnabled: boolean("comments_enabled").default(true).notNull(),
    contentRatingId: varchar("content_rating_id", { length: 30 }).references(() => contentRatings.id, { onDelete: "set null" }),
    isBlurred: boolean("is_blurred").default(false).notNull(),
    resolutions: text("resolutions").array(),
    tags: text("tags").array(),
    /** Taken down by an operator (DMCA, terms): hidden everywhere and never signed for playback. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removalReason: text("removal_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("videos_creator_idx").on(table.creatorId),
    visibilityIdx: index("videos_visibility_idx").on(table.visibility),
    statusIdx: index("videos_status_idx").on(table.status),
    createdAtIdx: index("videos_created_at_idx").on(table.createdAt),
  })
);

export const videoAccessGrants = pgTable(
  "video_access_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    grantedVia: varchar("granted_via", { length: 50 }).default("TIP_PAYMENT").notNull(),
    amountPaidCents: integer("amount_paid_cents").notNull(),
    transactionRef: text("transaction_ref").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    videoUserIdx: uniqueIndex("video_access_user_idx").on(table.videoId, table.userId),
  })
);
