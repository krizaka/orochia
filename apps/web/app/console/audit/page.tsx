import { AuditTable } from "@/console/components/AuditTable";
import { PageTitle } from "@/console/components/ui";
import { recentAudit } from "@/console/lib/account";
import type { Outcome } from "@/console/lib/audit-outcome";

const OUTCOMES: readonly string[] = ["ok", "refused", "failed"];

/** The operator log: every decision and sign-in of this console, newest first (the last 500). `?outcome=failed` opens it on one outcome (the Tasks view links here). */
export default async function AuditPage(props: { searchParams: Promise<{ outcome?: string }> }) {
  const { outcome } = await props.searchParams;
  const rows = await recentAudit(500);
  return (
    <div>
      <PageTitle title="Audit log" subtitle="Every decision and sign-in of this console, kept in its own database — who did what, to what, whether Orochia accepted it, and the request id to find the call." />
      <AuditTable
        outcome={outcome && OUTCOMES.includes(outcome) ? (outcome as Outcome) : undefined}
        rows={rows.map((r, i) => ({ id: `${new Date(r.at).getTime()}-${i}`, at: new Date(r.at).toISOString(), action: r.action, target: r.target, outcome: r.outcome, detail: r.detail, actor: r.actor, requestId: r.request_id }))}
      />
    </div>
  );
}
