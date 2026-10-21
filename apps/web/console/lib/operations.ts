/** What the operations page reads, reduced to plain facts (pure: the page only lays them out, the tests check the rules). */

export type Health = "up" | "degraded" | "down";

export interface OperationsInput {
  /** `/api/health` of Orochia, or null when it did not answer. */
  platformHealth: { status: string; services?: Record<string, string>; version?: string; commit?: string } | null;
  overview: { catalogue: { videosByStatus: Record<string, number> }; queues: { openReports: number; creatorsAwaitingVerification: number; payoutsInProgress: number } } | null;
  storage: { enabled: boolean; platform: { level: string; percent: number | null }; lastReconciliation: { missingVideos: number; orphanVideos: number } | null } | null;
  platform: { history: { kind: string; pending: number }; connections?: { pool: { max: number; total: number; idle: number; waiting: number }; open: number; limit: number } } | null;
}

export interface Dependency {
  id: "platform" | "database" | "storage" | "migrations";
  health: Health;
  detail: string;
}

export function dependencies(input: OperationsInput): Dependency[] {
  const h = input.platformHealth;
  const out: Dependency[] = [{ id: "platform", health: h ? (h.status === "healthy" ? "up" : "degraded") : "down", detail: h ? `${h.version ?? "?"}${h.commit ? ` · ${h.commit}` : ""}` : "no answer" }];
  out.push({ id: "database", health: h?.services?.database === "up" ? "up" : h ? "down" : "down", detail: h?.services?.database ?? "unknown" });
  if (input.storage) {
    const level = input.storage.platform.level;
    out.push({ id: "storage", health: level === "full" ? "down" : level === "critical" || level === "warning" ? "degraded" : "up", detail: `${level}${input.storage.platform.percent !== null ? ` · ${input.storage.platform.percent} %` : ""}` });
  }
  if (input.platform) {
    const kind = input.platform.history.kind;
    out.push({ id: "migrations", health: kind === "current" ? "up" : kind === "behind" ? "degraded" : "down", detail: kind === "behind" ? `${input.platform.history.pending} waiting` : kind });
  }
  return out;
}

export interface QueueDepth {
  id: string;
  count: number;
  /** Worth looking at: something is stuck or waiting for a person. */
  attention: boolean;
}

/** Work waiting for a person or a machine: videos not yet playable, reports, verifications, payouts. */
export function queues(input: OperationsInput): QueueDepth[] {
  if (!input.overview) return [];
  const v = input.overview.catalogue.videosByStatus;
  const q = input.overview.queues;
  const last = input.storage?.lastReconciliation;
  return [
    { id: "encoding", count: (v.PROCESSING ?? 0) + (v.PENDING_UPLOAD ?? 0), attention: false },
    { id: "held", count: v.HELD ?? 0, attention: (v.HELD ?? 0) > 0 },
    { id: "failed", count: v.FAILED ?? 0, attention: (v.FAILED ?? 0) > 0 },
    { id: "reports", count: q.openReports, attention: q.openReports > 0 },
    { id: "verification", count: q.creatorsAwaitingVerification, attention: false },
    { id: "payouts", count: q.payoutsInProgress, attention: false },
    ...(last ? [{ id: "missing", count: last.missingVideos, attention: last.missingVideos > 0 }] : []),
  ];
}

/** Share of a budget in use, 0–1, capped; 0 without a budget. */
export const share = (used: number, limit: number) => (limit > 0 ? Math.min(1, used / limit) : 0);
