import { createHash } from "node:crypto";

/**
 * The Explorer's rules, pure — so every case is a unit test. The Explorer finds videos by meaning: what a video says about
 * itself (its title, its tags, its description) is embedded by Orazaka, and a search or a "more like this" is a nearest
 * neighbour query next to the full-text search it completes (never replaces). Everything here is about *what is sent*,
 * *what is kept* and *how two rankings are merged*; the SQL is in lib/explorer-index.ts, the call in lib/orazaka.ts.
 */

/** Titles, tags and descriptions are short; a longer description is cut (the start says what a video is). */
export const MAX_DOCUMENT_CHARS = 1_000;
/** Videos embedded per Orazaka call (Orazaka accepts 128). */
export const INDEX_BATCH = 32;
/**
 * Cosine distance beyond which a neighbour is not "related" any more (0 = same meaning, 1 = unrelated). Measured on the
 * dev catalogue with BGE-M3: unrelated titles sit at 0.55+, a paraphrase under 0.35.
 */
export const MAX_DISTANCE = 0.5;
/** Neighbours asked of the index for one search. */
export const SEMANTIC_CANDIDATES = 24;

export interface VideoMetadata {
  title: string;
  tags: string[] | null;
  description: string | null;
}

/** Control characters (except tab and newline, folded below) have no place in a text sent to a model. */
const stripControl = (s: string) => Array.from(s, (c) => ((c.charCodeAt(0) < 32 && c !== "\t" && c !== "\n") || (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159) ? " " : c)).join("");

/**
 * The text of a video as it leaves for Orazaka: its public metadata and nothing else — no creator name or handle, no
 * comment, no price, no link. Control characters out, whitespace folded, cut at {@link MAX_DOCUMENT_CHARS}. Null when a
 * video has no title worth embedding.
 */
export function videoDocument(video: VideoMetadata): string | null {
  const clean = (s: string) => stripControl(s).replace(/\s+/g, " ").trim();
  const title = clean(video.title ?? "");
  if (!title) return null;
  const tags = (video.tags ?? []).map(clean).filter(Boolean).join(", ");
  const description = clean(video.description ?? "");
  return [title, tags && `Tags: ${tags}`, description].filter(Boolean).join("\n").slice(0, MAX_DOCUMENT_CHARS);
}

/** Fingerprint of an embedded text: an unchanged video is not embedded twice. */
export function documentHash(document: string): string {
  return createHash("sha256").update(document).digest("hex");
}

/** A search as it is compared and cached: lower case, one space between words, at most 100 characters. */
export function normalizeQuery(q: string): string {
  return q.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 100);
}

/** The pgvector text form of a vector, for a bound parameter (`$1::vector`). */
export function vectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

export type Provenance = "text" | "meaning" | "both";

export interface Fused {
  id: string;
  via: Provenance;
}

/**
 * Reciprocal rank fusion of the full-text ranking and the semantic one (k = 60, the standard constant): an item high in
 * either list rises, one in both rises most. Order is deterministic (ties: the text ranking first). Needs no score from
 * either side, so no weighting to tune.
 */
export function fuseRankings(text: readonly string[], meaning: readonly string[], k = 60): Fused[] {
  const score = new Map<string, number>();
  const seenText = new Set(text);
  const seenMeaning = new Set(meaning);
  const add = (ids: readonly string[]) => ids.forEach((id, i) => score.set(id, (score.get(id) ?? 0) + 1 / (k + i + 1)));
  add(text);
  add(meaning);
  const firstSeen = [...new Set([...text, ...meaning])];
  return firstSeen
    .map((id, order) => ({ id, order, score: score.get(id) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ id }) => ({ id, via: seenText.has(id) && seenMeaning.has(id) ? "both" : seenText.has(id) ? "text" : "meaning" }));
}

/** A bounded, expiring cache of query vectors: the same search typed twice, or by two people, costs one Orazaka call. */
export class VectorCache {
  private readonly entries = new Map<string, { vector: number[]; model: string; expiresAt: number }>();

  constructor(
    private readonly max = 200,
    private readonly ttlMs = 10 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): { vector: number[]; model: string } | null {
    const hit = this.entries.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    // Re-insert: the Map's order is the recency order.
    this.entries.delete(key);
    this.entries.set(key, hit);
    return { vector: hit.vector, model: hit.model };
  }

  set(key: string, value: { vector: number[]; model: string }): void {
    this.entries.delete(key);
    this.entries.set(key, { ...value, expiresAt: this.now() + this.ttlMs });
    while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value as string);
  }

  get size(): number {
    return this.entries.size;
  }
}
