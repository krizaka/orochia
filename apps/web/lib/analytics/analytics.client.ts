import { callOrazaka, type CallResult } from "../orazaka";
import {
  type AnalyticsEvent,
  type AnalyticsFunnel,
  AnalyticsFunnelSchema,
  AnalyticsIngestResultSchema,
  type AnalyticsInsights,
  AnalyticsInsightsSchema,
} from "./analytics.types";

/**
 * Orazaka's analytics (ADR-081), as Orochia calls it with its service key (scopes `analytics:sync`, `analytics:read`).
 * Every answer is parsed at the edge; failures are `OrazakaUnavailableError`. Sending stays off the circuit breaker
 * (the outbox retries); reading is behind it (a page never waits on a failing engine).
 */
const BASE = "/api/v1/analytics";

export function sendAnalyticsEvents(events: AnalyticsEvent[], timeoutMs?: number) {
  return callOrazaka({ method: "POST", path: `${BASE}/events`, body: { events }, schema: AnalyticsIngestResultSchema, timeoutMs, breaker: false });
}

export function fetchAnalyticsInsights(owner: string, from: string, to: string, timeoutMs: number): Promise<CallResult<AnalyticsInsights>> {
  return callOrazaka({ method: "GET", path: `${BASE}/insights`, query: { owner, from, to }, schema: AnalyticsInsightsSchema, timeoutMs });
}

export function fetchAnalyticsFunnel(owner: string, steps: string[], from: string, to: string, timeoutMs: number): Promise<CallResult<AnalyticsFunnel>> {
  return callOrazaka({ method: "GET", path: `${BASE}/funnel`, query: { owner, steps: steps.join(","), from, to }, schema: AnalyticsFunnelSchema, timeoutMs });
}
