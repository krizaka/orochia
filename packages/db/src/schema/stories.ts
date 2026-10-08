import { pgTable, text, timestamp, uuid, varchar, integer, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { audienceLists } from "./audiences";
import { contentRatings } from "./reference-data";
import { videoStatusEnum, videoVisibilityEnum } from "./enums";

/**
 * Stories: short images or videos that live 24 hours. A video story is a Bunny Stream video filed in
 * the stories collection (BUNNY_STREAM_STORIES_COLLECTION_ID), uploaded over Tus like any video and
 * moved to READY by the Bunny webhook; its 24 hours start when it is playable. Who sees a story uses
 * the video rules — public, approved followers, contacts, or one of the creator's audience lists
 * (INVITED_ONLY + audience_list_id, "close friends"). Paid unlocks do not apply to stories.
 */
export const stories = pgTable(
  "stories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    mediaType: varchar("media_type", { length: 20 }).default("IMAGE").notNull(), // 'IMAGE' | 'VIDEO'
    /** Bunny Stream video GUID of a video story (unique: the webhook finds the story by it). */
    bunnyVideoId: varchar("bunny_video_id", { length: 120 }),
    /** Image stories: the stored image. Video stories derive their URLs from bunny_video_id. */
    mediaUrl: text("media_url"),
    thumbnailUrl: text("thumbnail_url"),
    caption: varchar("caption", { length: 280 }),
    visibility: videoVisibilityEnum("visibility").default("PUBLIC").notNull(),
    audienceListId: uuid("audience_list_id").references(() => audienceLists.id, { onDelete: "set null" }),
    contentRatingId: varchar("content_rating_id", { length: 30 }).references(() => contentRatings.id, { onDelete: "set null" }),
    isBlurred: boolean("is_blurred").default(false).notNull(),
    status: videoStatusEnum("status").default("READY").notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    viewsCount: integer("views_count").default(0).notNull(),
    likesCount: integer("likes_count").default(0).notNull(),
    tipsCount: integer("tips_count").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("stories_creator_idx").on(table.creatorId),
    expiresAtIdx: index("stories_expires_at_idx").on(table.expiresAt),
    createdAtIdx: index("stories_created_at_idx").on(table.createdAt),
    bunnyVideoIdx: uniqueIndex("stories_bunny_video_idx").on(table.bunnyVideoId).where(sql`bunny_video_id is not null`),
  })
);

/** One row per viewer and story: a story view counts once (viewer_key as for videos: u:<id> or a salted guest hash). */
export const storyViews = pgTable(
  "story_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storyId: uuid("story_id")
      .references(() => stories.id, { onDelete: "cascade" })
      .notNull(),
    viewerId: uuid("viewer_id").references(() => users.id, { onDelete: "cascade" }),
    viewerKey: varchar("viewer_key", { length: 80 }).notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storyViewerIdx: index("story_views_story_viewer_idx").on(table.storyId, table.viewerId),
    oncePerViewer: uniqueIndex("story_views_once_idx").on(table.storyId, table.viewerKey),
  })
);

export const storyLikes = pgTable(
  "story_likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storyId: uuid("story_id")
      .references(() => stories.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storyUserUniqueIdx: uniqueIndex("story_likes_unique_idx").on(table.storyId, table.userId),
  })
);
