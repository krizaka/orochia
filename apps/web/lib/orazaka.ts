/**
 * The Orazaka client — the one door through which Orochia reaches AI (AGENTS.md: products consume AI only through
 * Orazaka, never a model provider). Server-only (it holds `AI_ENGINE_API_KEY`). It asks for embeddings
 * (`POST /api/v1/embeddings`, key scope `ai:embed`) for the Explorer, and talks to the recommender
 * (`/api/v1/recommendations/*`, scopes `reco:sync` and `reco:read`, ADR-078) through {@link callOrazaka}.
 *
 * AI is an addition, never a dependency: every failure — not configured, unreachable, refused, malformed — is a typed
 * {@link OrazakaUnavailableError} the caller answers with its non-AI path. After {@link BREAKER_FAILURES} failures in a
 * row the client stops calling for {@link BREAKER_OPEN_MS}, so a down engine costs a search nothing.
 */

import type { z } from "zod";

export type OrazakaFailure = "not_configured" | "circuit_open" | "unreachable" | "refused" | "not_found" | "bad_response";

export class OrazakaUnavailableError extends Error {
  constructor(
    readonly code: OrazakaFailure,
    message: string,
  ) {
    super(message);
    this.name = "OrazakaUnavailableError";
  }
}

export interface EmbedResult {
  /** The identifier of this run in Orazaka's logs (`embedding.run runId=…`) — the proof of use. */
  runId: string;
  model: string;
  dimensions: number;
  vectors: number[][];
  promptTokens: number;
  ms: number;
}

export interface OrazakaEnv {
  AI_ENGINE_URL?: string;
  AI_ENGINE_API_KEY?: string;
}

export const BREAKER_FAILURES = 3;
export const BREAKER_OPEN_MS = 60_000;
export const DEFAULT_TIMEOUT_MS = 8_000;
/** Orazaka's limit per request (EmbeddingClientImpl.MAX_BATCH). */
export const MAX_BATCH = 128;

interface Breaker {
  failures: number;
  openUntil: number;
}
const breaker: Breaker = { failures: 0, openUntil: 0 };

/** Test hook: closes the breaker. */
export function resetBreaker(): void {
  breaker.failures = 0;
  breaker.openUntil = 0;
}

export function breakerState(now = Date.now()): { open: boolean; failures: number; reopensAt: number | null } {
  const open = breaker.openUntil > now;
  return { open, failures: breaker.failures, reopensAt: open ? breaker.openUntil : null };
}

/** The connection, or null when `AI_ENGINE_URL` / `AI_ENGINE_API_KEY` are not both set. The key is never returned elsewhere. */
function connection(env: OrazakaEnv): { url: string; key: string } | null {
  const url = env.AI_ENGINE_URL?.trim().replace(/\/+$/, "");
  const key = env.AI_ENGINE_API_KEY?.trim();
  return url && key ? { url, key } : null;
}

export function orazakaConfigured(env: OrazakaEnv = process.env as OrazakaEnv): boolean {
  return connection(env) !== null;
}

export interface EmbedOptions {
  env?: OrazakaEnv;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

function fail(code: OrazakaFailure, message: string, now: number, countsAgainstBreaker: boolean): never {
  if (countsAgainstBreaker) {
    breaker.failures += 1;
    if (breaker.failures >= BREAKER_FAILURES) breaker.openUntil = now + BREAKER_OPEN_MS;
  }
  throw new OrazakaUnavailableError(code, message);
}

/** Embeds a batch of texts with Orazaka's embedding model. Throws {@link OrazakaUnavailableError}, never anything else. */
export async function embedTexts(texts: string[], options: EmbedOptions = {}): Promise<EmbedResult> {
  const now = options.now ?? Date.now;
  const start = now();
  const conn = connection(options.env ?? (process.env as OrazakaEnv));
  if (!conn) throw new OrazakaUnavailableError("not_configured", "Orazaka is not configured");
  if (texts.length === 0 || texts.length > MAX_BATCH || texts.some((t) => !t.trim())) {
    throw new Error(`embedTexts takes 1 to ${MAX_BATCH} non-blank texts`);
  }
  if (breaker.openUntil > start) throw new OrazakaUnavailableError("circuit_open", "Orazaka is paused after repeated failures");

  const doFetch = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(`${conn.url}/api/v1/embeddings`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${conn.key}` },
      body: JSON.stringify({ input: texts }),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    // The message of a network error can name the host, never the key; the type is all a caller needs.
    return fail("unreachable", "Orazaka did not answer", now(), true);
  }
  if (!response.ok) {
    // 4xx is ours to fix (key, scope, payload): it opens the breaker like a 5xx would, a bad key must not hammer the engine.
    return fail(response.status >= 500 ? "unreachable" : "refused", `Orazaka answered ${response.status}`, now(), true);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return fail("bad_response", "Orazaka answered something that is not JSON", now(), true);
  }
  const parsed = parseEmbeddings(body, texts.length);
  if (!parsed) return fail("bad_response", "Orazaka answered an unexpected shape", now(), true);

  breaker.failures = 0;
  breaker.openUntil = 0;
  return { ...parsed, ms: now() - start };
}

function parseEmbeddings(body: unknown, expected: number): Omit<EmbedResult, "ms"> | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as { runId?: unknown; model?: unknown; dimensions?: unknown; data?: unknown; usage?: { promptTokens?: unknown } };
  if (typeof b.runId !== "string" || !b.runId || typeof b.model !== "string" || !Array.isArray(b.data) || b.data.length !== expected) return null;
  const ordered = [...(b.data as { index?: unknown; embedding?: unknown }[])].sort((x, y) => Number(x.index) - Number(y.index));
  const vectors: number[][] = [];
  for (const item of ordered) {
    if (!Array.isArray(item.embedding) || item.embedding.length === 0 || !item.embedding.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
    vectors.push(item.embedding as number[]);
  }
  const dimensions = vectors[0].length;
  if (vectors.some((v) => v.length !== dimensions)) return null;
  return { runId: b.runId, model: b.model, dimensions, vectors, promptTokens: typeof b.usage?.promptTokens === "number" ? b.usage.promptTokens : 0 };
}

export interface CallOptions<T> {
  method: "GET" | "POST";
  /** A path under the edge, e.g. `/api/v1/recommendations/for-you`. */
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  /** The answer's schema: parsed at the edge, a mismatch is `bad_response`. */
  schema: z.ZodType<T>;
  env?: OrazakaEnv;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface CallResult<T> {
  data: T;
  /** `X-Orazaka-Request-Id` when Orazaka sent one — the line in its logs. */
  requestId: string | null;
  ms: number;
}

/**
 * One JSON call to Orazaka's edge with the service key, behind the same circuit breaker as the embeddings. Throws
 * {@link OrazakaUnavailableError}, never anything else; a 404 is `not_found` and does not count against the breaker (an
 * item Orazaka has not received yet is not an outage).
 */
export async function callOrazaka<T>(options: CallOptions<T>): Promise<CallResult<T>> {
  const now = options.now ?? Date.now;
  const start = now();
  const conn = connection(options.env ?? (process.env as OrazakaEnv));
  if (!conn) throw new OrazakaUnavailableError("not_configured", "Orazaka is not configured");
  if (breaker.openUntil > start) throw new OrazakaUnavailableError("circuit_open", "Orazaka is paused after repeated failures");

  const url = new URL(`${conn.url}${options.path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const doFetch = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url.toString(), {
      method: options.method,
      headers: {
        authorization: `Bearer ${conn.key}`,
        ...(options.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return fail("unreachable", "Orazaka did not answer", now(), true);
  }
  if (response.status === 404) throw new OrazakaUnavailableError("not_found", "Orazaka does not know it");
  if (!response.ok) {
    return fail(response.status >= 500 ? "unreachable" : "refused", `Orazaka answered ${response.status}`, now(), true);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return fail("bad_response", "Orazaka answered something that is not JSON", now(), true);
  }
  const parsed = options.schema.safeParse(body);
  if (!parsed.success) return fail("bad_response", "Orazaka answered an unexpected shape", now(), true);

  breaker.failures = 0;
  breaker.openUntil = 0;
  return { data: parsed.data, requestId: response.headers.get("x-orazaka-request-id"), ms: now() - start };
}
