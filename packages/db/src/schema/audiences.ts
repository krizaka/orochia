import { pgTable, timestamp, uuid, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { videos } from "./videos";
import { playlists } from "./playlists";

/**
 * Reusable audiences: an account names a list of people once ("Close friends") and opens INVITED_ONLY
 * videos and collections to it. Membership is live — adding someone to a list opens everything the
 * list is attached to; removing them closes it. Lists are private to their owner.
 */
export const audienceLists = pgTable(
  "audience_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ownerNameIdx: uniqueIndex("audience_lists_owner_name_idx").on(table.ownerId, table.name),
  })
);

export const audienceListMembers = pgTable(
  "audience_list_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listId: uuid("list_id")
      .references(() => audienceLists.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueMember: uniqueIndex("audience_list_members_unique_idx").on(table.listId, table.userId),
    userIdx: index("audience_list_members_user_idx").on(table.userId),
  })
);

/** Accounts invited one by one to an INVITED_ONLY video. */
export const videoViewers = pgTable(
  "video_viewers",
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
    uniqueViewer: uniqueIndex("video_viewers_unique_idx").on(table.videoId, table.userId),
    userIdx: index("video_viewers_user_idx").on(table.userId),
  })
);

/** Audience lists an INVITED_ONLY video is open to. */
export const videoAudienceLists = pgTable(
  "video_audience_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    listId: uuid("list_id")
      .references(() => audienceLists.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueList: uniqueIndex("video_audience_lists_unique_idx").on(table.videoId, table.listId),
    listIdx: index("video_audience_lists_list_idx").on(table.listId),
  })
);

/** Audience lists an INVITED_ONLY collection is open to (next to its individual members). */
export const playlistAudienceLists = pgTable(
  "playlist_audience_lists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playlistId: uuid("playlist_id")
      .references(() => playlists.id, { onDelete: "cascade" })
      .notNull(),
    listId: uuid("list_id")
      .references(() => audienceLists.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueList: uniqueIndex("playlist_audience_lists_unique_idx").on(table.playlistId, table.listId),
    listIdx: index("playlist_audience_lists_list_idx").on(table.listId),
  })
);
