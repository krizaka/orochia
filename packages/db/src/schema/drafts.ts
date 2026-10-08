import { pgTable, text, timestamp, uuid, varchar, integer, bigint, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { videoStatusEnum } from "./enums";

/**
 * Editor drafts, so an edit can be left and picked up later, from any device. The ORIGINAL clip is a Bunny
 * Stream video filed in the drafts collection (BUNNY_STREAM_DRAFTS_COLLECTION_ID), sent over Tus like any
 * video; the edit settings (trim, filter, format, sound…) and the form being filled are stored here, and the
 * optional music track privately in storage. A draft is kept DRAFT_RETENTION_DAYS (30 by default), then
 * removed with its files; publishing it renders a new file and the draft is deleted.
 */
export const videoDrafts = pgTable(
  "video_drafts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    kind: varchar("kind", { length: 10 }).notNull(), // 'VIDEO' | 'STORY'
    /** The original clip at Bunny (unique: the webhook finds the draft by it). */
    bunnyVideoId: varchar("bunny_video_id", { length: 120 }).notNull(),
    status: videoStatusEnum("status").default("PENDING_UPLOAD").notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    durationSeconds: integer("duration_seconds").default(0).notNull(),
    /** Editor settings (validated by parseStoredEdit). */
    edit: jsonb("edit").notNull(),
    /** What the upload form held: title, description, caption, audience… */
    details: jsonb("details").default(sql`'{}'::jsonb`).notNull(),
    /** Private storage reference of the music track, and its original name. */
    musicRef: text("music_ref"),
    musicName: varchar("music_name", { length: 255 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ownerIdx: index("video_drafts_owner_idx").on(table.ownerId, table.updatedAt),
    expiresAtIdx: index("video_drafts_expires_at_idx").on(table.expiresAt),
    bunnyVideoIdx: uniqueIndex("video_drafts_bunny_video_idx").on(table.bunnyVideoId),
  })
);
