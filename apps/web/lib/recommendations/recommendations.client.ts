import { callOrazaka, type CallResult } from "../orazaka";
import {
  CatalogueResultSchema,
  ErasureResultSchema,
  type Feed,
  FeedSchema,
  IngestResultSchema,
  type Insights,
  InsightsSchema,
  type Pseudonym,
  type RecoEvent,
  type RecoItem,
} from "./recommendations.types";

/**
 * Orazaka's recommender, as Orochia calls it (ADR-078 §6) — one function per endpoint, every answer parsed against the
 * recorded contract (recommendations-contract.json). Failures are `OrazakaUnavailableError` (lib/orazaka.ts): the
 * caller falls back, the outbox retries.
 */
const BASE = "/api/v1/recommendations";

export function sendEvents(events: RecoEvent[], timeoutMs?: number) {
  return callOrazaka({ method: "POST", path: `${BASE}/events`, body: { events }, schema: IngestResultSchema, timeoutMs });
}

export function sendItems(items: RecoItem[], timeoutMs?: number) {
  return callOrazaka({ method: "POST", path: `${BASE}/items`, body: { items }, schema: CatalogueResultSchema, timeoutMs });
}

export function sendErasure(erasure: { users: Pseudonym[]; items: string[] }, timeoutMs?: number) {
  return callOrazaka({ method: "POST", path: `${BASE}/erasures`, body: erasure, schema: ErasureResultSchema, timeoutMs });
}

export function fetchForYou(user: Pseudonym, limit: number, exclude: string[], timeoutMs: number): Promise<CallResult<Feed>> {
  return callOrazaka({ method: "GET", path: `${BASE}/for-you`, query: { user, limit, exclude: exclude.join(",") }, schema: FeedSchema, timeoutMs });
}

export function fetchSimilar(item: string, limit: number, timeoutMs: number): Promise<CallResult<Feed>> {
  return callOrazaka({ method: "GET", path: `${BASE}/similar`, query: { item, limit }, schema: FeedSchema, timeoutMs });
}

export function fetchInsights(creator: string, timeoutMs: number): Promise<CallResult<Insights>> {
  return callOrazaka({ method: "GET", path: `${BASE}/insights`, query: { creator }, schema: InsightsSchema, timeoutMs });
}
