import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const stories = pgTable(
  "stories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    mediaType: varchar("media_type", { length: 20 }).default("IMAGE").notNull(), // 'IMAGE' | 'VIDEO'
    bunnyVideoId: varchar("bunny_video_id", { length: 120 }), // Bunny.net Stream video GUID when video
    mediaUrl: text("media_url").notNull(), // Stream HLS playlist, direct CDN URL or image path
    thumbnailUrl: text("thumbnail_url"), // Thumbnail for quick preview/ring
    caption: varchar("caption", { length: 280 }),
    visibility: varchar("visibility", { length: 30 }).default("PUBLIC").notNull(), // 'PUBLIC' | 'CONTACTS_ONLY' | 'SUBSCRIBERS_ONLY'
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
  })
);

export const storyViews = pgTable(
  "story_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storyId: uuid("story_id")
      .references(() => stories.id, { onDelete: "cascade" })
      .notNull(),
    viewerId: uuid("viewer_id").references(() => users.id, { onDelete: "cascade" }),
    ipHash: varchar("ip_hash", { length: 64 }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storyViewerIdx: index("story_views_story_viewer_idx").on(table.storyId, table.viewerId),
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
