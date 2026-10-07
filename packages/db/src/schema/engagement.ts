import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  date,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { videos } from "./videos";
import { shareChannelEnum } from "./enums";

/**
 * One row per viewer, video and day: a view counts once a day per viewer, whatever the number of
 * plays. `viewer_key` is `u:<user id>` for an account, or a salted hash of the network address and
 * user agent for a guest — no address is stored.
 */
export const videoViews = pgTable(
  "video_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    viewerId: uuid("viewer_id").references(() => users.id, { onDelete: "set null" }),
    viewerKey: varchar("viewer_key", { length: 80 }).notNull(),
    viewedOn: date("viewed_on").defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    oncePerDay: uniqueIndex("video_views_once_per_day_idx").on(table.videoId, table.viewerKey, table.viewedOn),
    videoDayIdx: index("video_views_video_day_idx").on(table.videoId, table.viewedOn),
  })
);

export const videoLikes = pgTable(
  "video_likes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    oncePerUser: uniqueIndex("video_likes_once_idx").on(table.videoId, table.userId),
    userIdx: index("video_likes_user_idx").on(table.userId),
  })
);

/**
 * Comments and one level of replies (`parent_id`). Removal is soft — by the author, the video's
 * creator or an operator — so replies keep their thread and moderation keeps its trace.
 */
export const videoComments = pgTable(
  "video_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => videoComments.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: uuid("removed_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => ({
    videoCreatedIdx: index("video_comments_video_created_idx").on(table.videoId, table.createdAt),
    parentIdx: index("video_comments_parent_idx").on(table.parentId),
  })
);

export const videoShares = pgTable(
  "video_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    channel: shareChannelEnum("channel").default("LINK").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    videoIdx: index("video_shares_video_idx").on(table.videoId),
  })
);
