/**
 * The Orazaka client — the one door through which Orochia reaches AI (AGENTS.md: products consume AI only through
 * Orazaka, never a model provider). Server-only (it holds `AI_ENGINE_API_KEY`); today it asks for one thing: embeddings
 * (`POST /api/v1/embeddings`, key scope `ai:embed`), for the Explorer.
 *
 * AI is an addition, never a dependency: every failure — not configured, unreachable, refused, malformed — is a typed
 * {@link OrazakaUnavailableError} the caller answers with its non-AI path. After {@link BREAKER_FAILURES} failures in a
 * row the client stops calling for {@link BREAKER_OPEN_MS}, so a down engine costs a search nothing.
 */

export type OrazakaFailure = "not_configured" | "circuit_open" | "unreachable" | "refused" | "bad_response";

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
