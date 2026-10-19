import { AuditTable } from "@/console/components/AuditTable";
import { PageTitle } from "@/console/components/ui";
import { recentAudit } from "@/console/lib/account";

/** The operator log: every decision and sign-in of this console, newest first (the last 500). */
export default async function AuditPage() {
  const rows = await recentAudit(500);
  return (
    <div>
      <PageTitle title="Audit log" subtitle="Every decision and sign-in of this console, kept in its own database — who did what, to what, and whether Orochia accepted it." />
      <AuditTable rows={rows.map((r, i) => ({ id: `${new Date(r.at).getTime()}-${i}`, at: new Date(r.at).toISOString(), action: r.action, target: r.target, ok: r.ok, detail: r.detail, actor: r.actor, requestId: r.request_id }))} />
    </div>
  );
}
