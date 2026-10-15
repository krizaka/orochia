import { index, integer, pgTable, timestamp, uuid, varchar, vector } from "drizzle-orm/pg-core";
import { videos } from "./videos";

/** The dimension of the Explorer's vectors: BGE-M3 on Orazaka (the `embedding` category's default). A model of another size is a new migration. */
export const EXPLORER_DIMENSIONS = 1024;

/**
 * The Explorer's memory of what a video means: one vector per video, made by Orazaka from the video's own public
 * metadata (title, tags, description — never a frame, a comment, a name or anything private; only discoverable videos are
 * ever sent, lib/explorer.ts). Orochia keeps its vectors itself (pgvector) so that the meaning of a video is filtered by
 * the same discovery rules (lib/discoverable.ts) in the same query that ranks it; a takedown or a visibility change needs
 * no clean-up. `content_hash` is the hash of the embedded text (an unchanged video is not embedded again), `run_id` the
 * Orazaka run that produced it.
 */
export const explorerEmbeddings = pgTable(
  "explorer_embeddings",
  {
    videoId: uuid("video_id")
      .primaryKey()
      .references(() => videos.id, { onDelete: "cascade" }),
    model: varchar("model", { length: 80 }).notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    embedding: vector("embedding", { dimensions: EXPLORER_DIMENSIONS }).notNull(),
    runId: varchar("run_id", { length: 80 }).notNull(),
    embeddedAt: timestamp("embedded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    embeddingIdx: index("explorer_embeddings_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  }),
);

/**
 * Every call Orochia made to Orazaka for the Explorer: the proof of use, shown in the operator console. Only counts,
 * ids and timings — never a search text, a vector or a title. Pruned after a fortnight.
 */
export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** INDEX (videos embedded) · QUERY (a search embedded). */
    kind: varchar("kind", { length: 16 }).notNull(),
    /** The identifier Orazaka answered (`embedding.run runId=…` in its logs); null when the call failed. */
    orazakaRunId: varchar("orazaka_run_id", { length: 80 }),
    model: varchar("model", { length: 80 }),
    inputs: integer("inputs").default(0).notNull(),
    promptTokens: integer("prompt_tokens").default(0).notNull(),
    /** OK, or the failure code (not_configured · circuit_open · unreachable · refused · bad_response). */
    status: varchar("status", { length: 24 }).notNull(),
    durationMs: integer("duration_ms").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    createdIdx: index("ai_runs_created_idx").on(table.createdAt),
  }),
);
