/**
 * The Explorer's data side against a real PostgreSQL with pgvector (the `database` and `e2e` jobs' image, or
 * `docker run -p 56432:5432 -e POSTGRES_PASSWORD=x pgvector/pgvector:pg16`): the discovery rules hold for meaning exactly as
 * for words, an unchanged video is not embedded twice, a failing engine leaves its trace and breaks nothing.
 * Runs when EXPLORER_IT=1 on a migrated and seeded database (DATABASE_URL). The engine is a deterministic stand-in (words
 * hashed into the 1024 dimensions): the real model is proven by the live check, not by a unit test.
 */
import { createHash, randomUUID } from "node:crypto";

import { aiRuns, complianceReports, db, EXPLORER_DIMENSIONS, explorerEmbeddings, users, videos } from "@orochia/db";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type EmbedFn,embedPending, nearestVideoIds, queryVector, relatedVideoIds } from "./explorer-index";
import { OrazakaUnavailableError } from "./orazaka";

const enabled = process.env.EXPLORER_IT === "1";
const TAG = `it-${randomUUID().slice(0, 8)}`;

/** Bag of words hashed into the vector: two texts sharing words are near, two sharing none are orthogonal. */
function vectorOf(text: string): number[] {
  const v = new Array<number>(EXPLORER_DIMENSIONS).fill(0);
  for (const word of text.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
    v[createHash("sha256").update(word).digest().readUInt16BE(0) % EXPLORER_DIMENSIONS] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
const stub: EmbedFn = async (texts) => ({ runId: `run-${randomUUID()}`, model: "stub-embed", dimensions: EXPLORER_DIMENSIONS, vectors: texts.map(vectorOf), promptTokens: texts.length * 5, ms: 1 });

describe.skipIf(!enabled)("Explorer index (pgvector)", () => {
  const ids: Record<string, string> = {};
  let creatorId: string;

  async function addVideo(key: string, title: string, tags: string[], extra: Partial<typeof videos.$inferInsert> = {}) {
    const [row] = await db
      .insert(videos)
      .values({ creatorId, bunnyVideoId: `${TAG}-${key}`, title: `${title} ${TAG}`, tags, description: null, visibility: "PUBLIC", status: "READY", ...extra })
      .returning({ id: videos.id });
    ids[key] = row.id;
  }

  beforeAll(async () => {
    process.env.AI_ENGINE_URL = "http://engine.invalid/edge";
    process.env.AI_ENGINE_API_KEY = "oz_live_test";
    const [creator] = await db.select({ id: users.id }).from(users).where(eq(users.role, "CREATOR")).limit(1);
    creatorId = creator.id;
    await addVideo("tokyo", "Tokyo neon alley at night", ["tokyo", "neon", "night"]);
    await addVideo("osaka", "Osaka neon street food at night", ["osaka", "neon", "food"]);
    await addVideo("garden", "Quiet zen garden in spring", ["garden", "spring", "zen"]);
    await addVideo("secret", "Tokyo neon alley at night private cut", ["tokyo", "neon", "night"], { visibility: "INVITED_ONLY" });
    await addVideo("pending", "Tokyo neon alley still processing", ["tokyo", "neon"], { status: "PROCESSING" });
  });

  afterAll(async () => {
    await db.delete(videos).where(like(videos.bunnyVideoId, `${TAG}-%`));
    await db.delete(aiRuns).where(eq(aiRuns.model, "stub-embed"));
  });

  it("embeds the discoverable videos only, and records the run", async () => {
    const summary = await embedPending({ embed: stub, limit: 200 });
    expect(summary.failure).toBeNull();
    const embedded = await db.select({ id: explorerEmbeddings.videoId }).from(explorerEmbeddings).where(inArray(explorerEmbeddings.videoId, Object.values(ids)));
    expect(embedded.map((e) => e.id).sort()).toEqual([ids.tokyo, ids.osaka, ids.garden].sort());
    const [run] = await db.select().from(aiRuns).where(eq(aiRuns.model, "stub-embed")).limit(1);
    expect(run).toMatchObject({ kind: "INDEX", status: "OK" });
    expect(run.orazakaRunId).toMatch(/^run-/);
  });

  it("does not embed an unchanged video twice", async () => {
    let calls = 0;
    const counting: EmbedFn = async (t) => (calls++, stub(t));
    await db.update(videos).set({ updatedAt: new Date() }).where(eq(videos.id, ids.tokyo));
    const summary = await embedPending({ embed: counting, limit: 200 });
    expect(calls).toBe(0);
    expect(summary.unchanged).toBeGreaterThanOrEqual(1);
  });

  it("finds by meaning what the words alone would miss, nearest first", async () => {
    const q = await queryVector("neon alley tokyo night", { embed: stub });
    if (q.status !== "ok") throw new Error(`query vector: ${q.status}`);
    const found = await nearestVideoIds(q.vector, q.model, 10, 0.9);
    expect(found[0]).toBe(ids.tokyo);
    expect(found).toContain(ids.osaka);
    expect(found).not.toContain(ids.garden);
  });

  it("never matches a video Explore would not show: not public, not ready, taken down, held for a report", async () => {
    const q = await queryVector("tokyo neon alley night private cut", { embed: stub });
    if (q.status !== "ok") throw new Error("no vector");
    expect(await nearestVideoIds(q.vector, q.model, 10, 0.99)).not.toContain(ids.secret);
    expect(await nearestVideoIds(q.vector, q.model, 10, 0.99)).not.toContain(ids.pending);

    await db.update(videos).set({ removedAt: new Date(), removalReason: "test" }).where(eq(videos.id, ids.osaka));
    expect(await nearestVideoIds(q.vector, q.model, 10, 0.99)).not.toContain(ids.osaka);
    await db.update(videos).set({ removedAt: null, removalReason: null }).where(eq(videos.id, ids.osaka));
    expect(await nearestVideoIds(q.vector, q.model, 10, 0.99)).toContain(ids.osaka);

    await db.insert(complianceReports).values({ videoId: ids.osaka, videoTitle: "t", reason: "UNDERAGE", details: "test", reporterEmail: "it@example.org", status: "OPEN" });
    expect(await nearestVideoIds(q.vector, q.model, 10, 0.99)).not.toContain(ids.osaka);
    await db.delete(complianceReports).where(eq(complianceReports.videoId, ids.osaka));
  });

  it("'more like this' is the nearest discoverable videos to a video's own vector, never itself", async () => {
    const related = await relatedVideoIds(ids.tokyo, 5, 0.95);
    expect(related).toContain(ids.osaka);
    if (related.includes(ids.garden)) expect(related.indexOf(ids.osaka)).toBeLessThan(related.indexOf(ids.garden));
    expect(related).not.toContain(ids.tokyo);
    expect(related).not.toContain(ids.secret);
    expect(await relatedVideoIds(ids.secret, 5)).toEqual([]);

    // Once a video stops being public, what is related to it is no longer told, though its old vector is still kept.
    await db.update(videos).set({ visibility: "INVITED_ONLY" }).where(eq(videos.id, ids.garden));
    expect(await relatedVideoIds(ids.garden, 5, 0.99)).toEqual([]);
    await db.update(videos).set({ visibility: "PUBLIC" }).where(eq(videos.id, ids.garden));
  });

  it("a failing engine leaves its trace, answers 'unavailable' and breaks nothing", async () => {
    const down: EmbedFn = async () => {
      throw new OrazakaUnavailableError("unreachable", "Orazaka did not answer");
    };
    expect(await queryVector("a search nobody cached before", { embed: down })).toEqual({ status: "unavailable" });
    const [run] = await db.select().from(aiRuns).where(eq(aiRuns.status, "unreachable")).limit(1);
    expect(run).toMatchObject({ kind: "QUERY", orazakaRunId: null });
    await db.delete(aiRuns).where(eq(aiRuns.status, "unreachable"));
  });
});
