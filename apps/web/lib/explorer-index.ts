import { aiRuns, db, EXPLORER_DIMENSIONS, explorerEmbeddings, users, videos } from "@orochia/db";
import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { discoverableVideo } from "./explore";
import { documentHash, INDEX_BATCH, MAX_DISTANCE, normalizeQuery, SEMANTIC_CANDIDATES, VectorCache, videoDocument } from "./explorer";
import { breakerState, type EmbedResult, embedTexts, orazakaConfigured,OrazakaUnavailableError } from "./orazaka";
import { checkRateLimit } from "./rate-limit";

/**
 * The Explorer's data side: indexing public videos through Orazaka, and the nearest-neighbour queries behind semantic
 * search and "more like this". Vectors live in `explorer_embeddings` (pgvector, orochia_db); every query goes through
 * `discoverableVideo()` (lib/explore.ts), the one definition of what Explore may show — so a private, paid, followers-only,
 * held or taken-down video never matches, whatever its vector says. Every call to Orazaka leaves a row in `ai_runs`.
 */

export type EmbedFn = (texts: string[]) => Promise<EmbedResult>;

const queryVectors = new VectorCache();

/** A call to Orazaka, written down: counts, ids and timings only. Best-effort — a failing log never fails a search. */
async function recordRun(run: { kind: "INDEX" | "QUERY"; result?: EmbedResult; failure?: string; inputs: number; ms: number }): Promise<void> {
  try {
    await db.insert(aiRuns).values({
      kind: run.kind,
      orazakaRunId: run.result?.runId ?? null,
      model: run.result?.model ?? null,
      inputs: run.inputs,
      promptTokens: run.result?.promptTokens ?? 0,
      status: run.failure ?? "OK",
      durationMs: run.result?.ms ?? run.ms,
    });
  } catch (error) {
    console.error("[explorer] could not record the run", error);
  }
}

export async function pruneRuns(days = 14): Promise<void> {
  await db.delete(aiRuns).where(lt(aiRuns.createdAt, sql`now() - make_interval(days => ${days})`)).catch(() => undefined);
}

// ── Indexing ──────────────────────────────────────────────────────────────────────────────────

export interface SyncSummary {
  configured: boolean;
  /** Discoverable videos with no vector, or edited since. */
  candidates: number;
  embedded: number;
  /** Edited but with the same words: kept as they are. */
  unchanged: number;
  runs: number;
  failure: string | null;
}

/** Embeds the discoverable videos that have no vector yet or were edited since, newest first, `limit` at most. */
export async function embedPending({ limit = 64, embed = embedTexts }: { limit?: number; embed?: EmbedFn } = {}): Promise<SyncSummary> {
  const summary: SyncSummary = { configured: orazakaConfigured(), candidates: 0, embedded: 0, unchanged: 0, runs: 0, failure: null };
  if (!summary.configured) return summary;

  // The catalogue's embedding model can change (an administrator picks another default): vectors of another model never
  // match a query, so they are re-embedded, a round at a time. The current model is the one Orazaka last answered with.
  const [last] = await db.select({ model: aiRuns.model }).from(aiRuns).where(and(eq(aiRuns.status, "OK"), sql`${aiRuns.model} is not null`)).orderBy(desc(aiRuns.createdAt)).limit(1);
  const stale = last?.model ? sql`${explorerEmbeddings.model} <> ${last.model}` : sql`false`;
  const rows = await db
    .select({ id: videos.id, title: videos.title, tags: videos.tags, description: videos.description, hash: explorerEmbeddings.contentHash, model: explorerEmbeddings.model })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(explorerEmbeddings, eq(explorerEmbeddings.videoId, videos.id))
    .where(and(discoverableVideo(), or(isNull(explorerEmbeddings.videoId), sql`${explorerEmbeddings.embeddedAt} < ${videos.updatedAt}`, stale)))
    .orderBy(desc(videos.createdAt))
    .limit(limit);
  summary.candidates = rows.length;

  const todo: { id: string; document: string; hash: string }[] = [];
  const touched: string[] = [];
  for (const row of rows) {
    const document = videoDocument(row);
    if (!document) continue;
    const hash = documentHash(document);
    // Same words and same model: nothing to ask Orazaka. Same words, another model: embed again.
    if (row.hash === hash && (!last?.model || row.model === last.model)) touched.push(row.id);
    else todo.push({ id: row.id, document, hash });
  }
  summary.unchanged = touched.length;
  if (touched.length) {
    await db.update(explorerEmbeddings).set({ embeddedAt: sql`now()` }).where(inArray(explorerEmbeddings.videoId, touched));
  }

  for (let i = 0; i < todo.length; i += INDEX_BATCH) {
    const batch = todo.slice(i, i + INDEX_BATCH);
    const started = Date.now();
    let result: EmbedResult;
    try {
      result = await embed(batch.map((b) => b.document));
    } catch (error) {
      const failure = error instanceof OrazakaUnavailableError ? error.code : "bad_response";
      await recordRun({ kind: "INDEX", failure, inputs: batch.length, ms: Date.now() - started });
      summary.runs += 1;
      summary.failure = failure;
      break;
    }
    summary.runs += 1;
    if (result.dimensions !== EXPLORER_DIMENSIONS) {
      // A model of another size needs a migration, not a silent truncation.
      await recordRun({ kind: "INDEX", failure: "bad_response", inputs: batch.length, ms: result.ms });
      summary.failure = "bad_response";
      break;
    }
    await db
      .insert(explorerEmbeddings)
      .values(batch.map((b, n) => ({ videoId: b.id, model: result.model, contentHash: b.hash, embedding: result.vectors[n], runId: result.runId })))
      .onConflictDoUpdate({
        target: explorerEmbeddings.videoId,
        set: { model: sql`excluded.model`, contentHash: sql`excluded.content_hash`, embedding: sql`excluded.embedding`, runId: sql`excluded.run_id`, embeddedAt: sql`now()` },
      });
    await recordRun({ kind: "INDEX", result, inputs: batch.length, ms: result.ms });
    summary.embedded += batch.length;
  }
  await pruneRuns();
  return summary;
}

// ── Queries ───────────────────────────────────────────────────────────────────────────────────

export type SemanticStatus = "ok" | "off" | "unavailable" | "throttled";

/**
 * The vector of a search, from Orazaka (cached ten minutes). Null when it cannot be had — not configured, paused, down,
 * throttled — and the caller carries on with full-text search alone.
 */
export async function queryVector(q: string, { embed = embedTexts }: { embed?: EmbedFn } = {}): Promise<{ vector: number[]; model: string; status: SemanticStatus } | { status: Exclude<SemanticStatus, "ok"> }> {
  const key = normalizeQuery(q);
  if (!key) return { status: "off" };
  if (!orazakaConfigured()) return { status: "off" };
  const cached = queryVectors.get(key);
  if (cached) return { ...cached, status: "ok" };
  // A global ceiling on what searches may spend at Orazaka: over it, searches are full-text only for a moment.
  if (!(await checkRateLimit("explorer:embed", 60, 60)).success) return { status: "throttled" };

  const started = Date.now();
  try {
    const result = await embed([key]);
    if (result.dimensions !== EXPLORER_DIMENSIONS) throw new OrazakaUnavailableError("bad_response", "unexpected dimensions");
    await recordRun({ kind: "QUERY", result, inputs: 1, ms: result.ms });
    const value = { vector: result.vectors[0], model: result.model };
    queryVectors.set(key, value);
    return { ...value, status: "ok" };
  } catch (error) {
    const failure = error instanceof OrazakaUnavailableError ? error.code : "bad_response";
    // An open breaker is already known and already written down; do not flood ai_runs with one row per search.
    if (failure !== "circuit_open") await recordRun({ kind: "QUERY", failure, inputs: 1, ms: Date.now() - started });
    return { status: "unavailable" };
  }
}

/** Ids of the discoverable videos nearest to a vector, nearest first. */
export async function nearestVideoIds(vector: number[], model: string, limit = SEMANTIC_CANDIDATES, maxDistance = MAX_DISTANCE): Promise<string[]> {
  const distance = sql<number>`(${explorerEmbeddings.embedding} <=> ${`[${vector.join(",")}]`}::vector)`;
  const rows = await db
    .select({ id: videos.id })
    .from(explorerEmbeddings)
    .innerJoin(videos, eq(videos.id, explorerEmbeddings.videoId))
    .innerJoin(users, eq(users.id, videos.creatorId))
    .where(and(discoverableVideo(), eq(explorerEmbeddings.model, model), sql`${distance} < ${maxDistance}`))
    .orderBy(distance)
    .limit(limit);
  return rows.map((r) => r.id);
}

/**
 * "More like this": the discoverable videos nearest to a video's own stored vector, never the video itself. No Orazaka
 * call at read time — the meaning was kept when the video was indexed. Empty when the video has no vector yet.
 */
export async function relatedVideoIds(videoId: string, limit = 6, maxDistance = MAX_DISTANCE): Promise<string[]> {
  // What is related to a video Explore would not show is never told — a vector kept from when it was public does not change that.
  const [visible] = await db.select({ id: videos.id }).from(videos).innerJoin(users, eq(users.id, videos.creatorId)).where(and(eq(videos.id, videoId), discoverableVideo())).limit(1);
  if (!visible) return [];
  const seed = db.select({ embedding: explorerEmbeddings.embedding, model: explorerEmbeddings.model }).from(explorerEmbeddings).where(eq(explorerEmbeddings.videoId, videoId)).as("seed");
  const distance = sql<number>`(${explorerEmbeddings.embedding} <=> ${seed.embedding})`;
  const rows = await db
    .select({ id: videos.id })
    .from(explorerEmbeddings)
    .innerJoin(seed, eq(seed.model, explorerEmbeddings.model))
    .innerJoin(videos, eq(videos.id, explorerEmbeddings.videoId))
    .innerJoin(users, eq(users.id, videos.creatorId))
    .where(and(discoverableVideo(), sql`${videos.id} <> ${videoId}`, sql`${distance} < ${maxDistance}`))
    .orderBy(distance)
    .limit(limit);
  return rows.map((r) => r.id);
}

// ── The operator's view ───────────────────────────────────────────────────────────────────────

export interface ExplorerStatus {
  configured: boolean;
  engine: string | null;
  breaker: { open: boolean; failures: number; reopensAt: string | null };
  discoverable: number;
  embedded: number;
  models: string[];
  runs: { id: string; kind: string; orazakaRunId: string | null; model: string | null; inputs: number; promptTokens: number; status: string; durationMs: number; createdAt: string }[];
}

export async function explorerStatus(runLimit = 25): Promise<ExplorerStatus> {
  const [counts] = await db
    .select({ discoverable: sql<number>`count(*)::int`, embedded: sql<number>`count(${explorerEmbeddings.videoId})::int` })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.creatorId))
    .leftJoin(explorerEmbeddings, eq(explorerEmbeddings.videoId, videos.id))
    .where(discoverableVideo());
  const models = await db.select({ model: explorerEmbeddings.model }).from(explorerEmbeddings).groupBy(explorerEmbeddings.model);
  const runs = await db.select().from(aiRuns).orderBy(desc(aiRuns.createdAt)).limit(runLimit);
  const state = breakerState();
  const url = process.env.AI_ENGINE_URL?.trim();
  return {
    configured: orazakaConfigured(),
    // The engine's host only: the key and the path are not for a screen.
    engine: url ? (() => { try { return new URL(url).host; } catch { return null; } })() : null,
    breaker: { open: state.open, failures: state.failures, reopensAt: state.reopensAt ? new Date(state.reopensAt).toISOString() : null },
    discoverable: counts?.discoverable ?? 0,
    embedded: counts?.embedded ?? 0,
    models: models.map((m) => m.model),
    runs: runs.map((r) => ({ id: r.id, kind: r.kind, orazakaRunId: r.orazakaRunId, model: r.model, inputs: r.inputs, promptTokens: r.promptTokens, status: r.status, durationMs: r.durationMs, createdAt: r.createdAt.toISOString() })),
  };
}
