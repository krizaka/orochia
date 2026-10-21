import { Badge } from "@krizaka/ui/badge";
import Link from "next/link";

import { Empty, PageTitle, Panel } from "@/console/components/ui";
import { recentAudit } from "@/console/lib/account";
import { now } from "@/console/lib/clock";
import { orochia } from "@/console/lib/orochia";
import { deriveTasks } from "@/console/lib/tasks";

/** What waits for the operator, derived from the platform's counters and from the audit: nothing here is typed in. */
export default async function TasksPage() {
  const [{ data: overview }, storage, rows] = await Promise.all([
    orochia<{ data: Parameters<typeof deriveTasks>[0]["overview"] }>("/api/admin/overview"),
    orochia<{ storage: Parameters<typeof deriveTasks>[0]["storage"] }>("/api/admin/storage?top=1").catch(() => null),
    recentAudit(200),
  ]);
  const tasks = deriveTasks({
    overview,
    storage: storage?.storage ?? null,
    audit: rows.map((r) => ({ at: new Date(r.at).toISOString(), action: r.action, target: r.target, outcome: r.outcome, requestId: r.request_id, actor: r.actor, detail: r.detail })),
    now: now(),
  });
  return (
    <div>
      <PageTitle title="Tasks" subtitle="What waits for you: the queues of the platform, and the actions of the last day that Orochia refused or could not do." />
      {tasks.length === 0 ? (
        <Empty>Nothing waits. Reports, verifications and payouts are all up to date.</Empty>
      ) : (
        <Panel>
          <ul className="divide-y divide-border-subtle" aria-label="Tasks">
            {tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                <Badge tone={task.urgency === "now" ? "danger" : "warning"}>{task.urgency === "now" ? "now" : "soon"}</Badge>
                <Link href={task.href} className="min-w-0 flex-1 text-sm font-semibold text-fg underline-offset-2 hover:underline">
                  {task.title}
                </Link>
                {task.source === "platform" ? <span className="font-mono text-sm text-fg">{task.count}</span> : task.requestId ? <span className="font-mono text-[11px] text-fg-secondary">request {task.requestId}</span> : null}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
