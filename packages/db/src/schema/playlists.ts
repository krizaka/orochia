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
import { videos } from "./videos";
import { collectionVisibilityEnum } from "./enums";

export const playlists = pgTable(
  "playlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    /** Who may open the collection; INVITED_ONLY reads playlist_members. */
    visibility: collectionVisibilityEnum("visibility").default("PRIVATE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    creatorIdx: index("playlists_creator_idx").on(table.creatorId),
  })
);

export const playlistItems = pgTable(
  "playlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playlistId: uuid("playlist_id")
      .references(() => playlists.id, { onDelete: "cascade" })
      .notNull(),
    videoId: uuid("video_id")
      .references(() => videos.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    playlistPositionIdx: index("playlist_items_position_idx").on(table.playlistId, table.position),
    uniqueVideoInPlaylist: uniqueIndex("playlist_video_unique_idx").on(table.playlistId, table.videoId),
  })
);

/** Accounts a collection owner invited: they open an INVITED_ONLY collection. */
export const playlistMembers = pgTable(
  "playlist_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playlistId: uuid("playlist_id")
      .references(() => playlists.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueMember: uniqueIndex("playlist_members_unique_idx").on(table.playlistId, table.userId),
    userIdx: index("playlist_members_user_idx").on(table.userId),
  })
);
