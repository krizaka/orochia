import type { AuditEntry } from "./audit-outcome";

/**
 * The operator's tasks (Dev preview `admin.operator-tasks`): a queue derived from what the platform reports and from the
 * console's own audit — never typed in, never a second source of truth. Pure: the page only lays it out.
 *
 *  - a counter of the platform that waits for a person (reports, verifications, payouts, videos that failed or are held,
 *    files Bunny lost);
 *  - an action of the last day that Orochia refused or could not do, and that no later success on the same target fixed.
 */
export interface TaskInput {
  overview: { queues: { openReports: number; creatorsAwaitingVerification: number; payoutsInProgress: number }; catalogue: { videosByStatus: Record<string, number> } } | null;
  storage: { lastReconciliation: { missingVideos: number; orphanVideos: number } | null } | null;
  /** Newest first or not: the order does not matter. */
  audit: AuditEntry[];
  now: number;
}

export type Urgency = "now" | "soon";

export interface Task {
  id: string;
  title: string;
  /** How many items wait (1 for an action that did not go through). */
  count: number;
  href: string;
  urgency: Urgency;
  source: "platform" | "audit";
  /** The request id of the call that did not go through, to find it in the platform's logs. */
  requestId?: string | null;
  detail?: string | null;
}

const DAY = 86_400_000;

export function deriveTasks({ overview, storage, audit, now }: TaskInput): Task[] {
  const tasks: Task[] = [];
  const add = (id: string, title: string, count: number, href: string, urgency: Urgency) => {
    if (count > 0) tasks.push({ id, title, count, href, urgency, source: "platform" });
  };
  if (overview) {
    const q = overview.queues;
    const v = overview.catalogue.videosByStatus;
    add("reports", "Content reports to review", q.openReports, "/moderation", "now");
    add("failed-videos", "Videos that failed to encode", v.FAILED ?? 0, "/catalogue", "now");
    add("held-videos", "Videos held for lack of space", v.HELD ?? 0, "/storage", "soon");
    add("verification", "Creators awaiting 2257 verification", q.creatorsAwaitingVerification, "/compliance", "soon");
    add("payouts", "Payouts in progress", q.payoutsInProgress, "/treasury", "soon");
  }
  const lost = storage?.lastReconciliation?.missingVideos ?? 0;
  add("missing-files", "Videos whose file is missing on Bunny", lost, "/storage", "now");

  // Newest first: the first entry met for an action and its target tells whether it is settled.
  const recent = audit.filter((a) => now - Date.parse(a.at) <= DAY).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const seen = new Set<string>();
  for (const a of recent) {
    const key = `${a.action}:${a.target ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (a.outcome === "ok") continue;
    tasks.push({
      id: `audit:${key}`,
      title: `${a.outcome === "failed" ? "Did not go through" : "Refused"}: ${a.action}${a.target ? ` (${a.target})` : ""}`,
      count: 1,
      href: `/audit?outcome=${a.outcome}`,
      urgency: a.outcome === "failed" ? "now" : "soon",
      source: "audit",
      requestId: a.requestId,
      detail: a.detail,
    });
  }
  return tasks;
}
