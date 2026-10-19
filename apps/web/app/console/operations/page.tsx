import { Badge } from "@krizaka/ui/badge";
import { Meter } from "@krizaka/ui/meter";

import { Empty, PageTitle, Panel, Stat } from "@/console/components/ui";
import { BUILD_INFO } from "@/console/lib/build-info";
import { dbBudget } from "@/console/lib/db";
import { dependencies, type OperationsInput,queues, share } from "@/console/lib/operations";
import { apiBaseUrl, orochia } from "@/console/lib/orochia";

const LABEL = { platform: "Orochia platform", database: "Orochia database", storage: "Storage at Bunny", migrations: "Migrations" } as const;
const QUEUE = {
  encoding: "Videos encoding or uploading",
  held: "Videos held (no space)",
  failed: "Videos failed",
  reports: "Open content reports",
  verification: "Creators awaiting 2257 verification",
  payouts: "Payouts in progress",
  missing: "Videos missing at Bunny (last reconciliation)",
} as const;

/** Each source is read on its own: a source that does not answer is said down, the rest is still shown. */
async function read<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

/** Operations: dependencies, queues, the console's own pool against its budget, and what is deployed. */
export default async function OperationsPage() {
  const [platformHealth, overview, storage, platform] = await Promise.all([
    read(async () => {
      const res = await fetch(`${apiBaseUrl()}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      return (await res.json()) as NonNullable<OperationsInput["platformHealth"]>;
    }),
    read(async () => (await orochia<{ data: NonNullable<OperationsInput["overview"]> }>("/api/admin/overview")).data),
    read(async () => (await orochia<{ storage: NonNullable<OperationsInput["storage"]> }>("/api/admin/storage?top=1")).storage),
    read(async () => (await orochia<{ platform: NonNullable<OperationsInput["platform"]> }>("/api/admin/platform")).platform),
  ]);
  // Read after the others: the pool is measured while it is quiet, not while this page's own reads hold its connections.
  const budget = await read(dbBudget);
  const deps = dependencies({ platformHealth, overview, storage, platform });
  const work = queues({ platformHealth, overview, storage, platform });

  return (
    <div>
      <PageTitle title="Operations" subtitle="Is Orochia up, what is waiting, what is deployed — read live. A source that does not answer is shown down." />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {deps.map((d) => (
          <Stat key={d.id} label={LABEL[d.id]} value={d.health === "up" ? "Up" : d.health === "degraded" ? "Degraded" : "Down"} hint={d.detail} tone={d.health === "up" ? "success" : d.health === "degraded" ? "warning" : "danger"} />
        ))}
      </div>

      <section aria-labelledby="queues-title" className="mb-8">
        <h2 id="queues-title" className="mb-3 text-sm font-bold text-fg">Queues</h2>
        {work.length === 0 ? (
          <Empty>The platform did not answer: no queue to show.</Empty>
        ) : (
          <Panel>
            <ul className="grid gap-3 sm:grid-cols-2">
              {work.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-fg-secondary">{QUEUE[q.id as keyof typeof QUEUE]}</span>
                  <Badge tone={q.attention ? "danger" : "neutral"}>{q.count}</Badge>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="db-title">
          <h2 id="db-title" className="mb-3 text-sm font-bold text-fg">This console&apos;s database</h2>
          <Panel>
            {budget ? (
              <div className="flex flex-col gap-3">
                <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={`Pool: ${budget.pool.total - budget.pool.idle} busy of ${budget.pool.max} (${budget.pool.total} open)`} value={share(budget.pool.total - budget.pool.idle, budget.pool.max)} max={1} />
                <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={`Connections on the database: ${budget.open} of ${budget.limit}`} value={share(budget.open, budget.limit)} max={1} />
                <p className="text-xs text-fg-secondary">{budget.pool.waiting} waiting.</p>
              </div>
            ) : (
              <Empty>The console&apos;s database did not answer.</Empty>
            )}
          </Panel>
        </section>
        <section aria-labelledby="platform-db-title">
          <h2 id="platform-db-title" className="mb-3 text-sm font-bold text-fg">Orochia&apos;s database</h2>
          <Panel>
            {platform?.connections ? (
              <div className="flex flex-col gap-3">
                <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={`Pool: ${platform.connections.pool.total - platform.connections.pool.idle} busy of ${platform.connections.pool.max} (${platform.connections.pool.total} open)`} value={share(platform.connections.pool.total - platform.connections.pool.idle, platform.connections.pool.max)} max={1} />
                <Meter showLabel thresholds={{ low: 0.7, high: 0.9 }} label={`Connections on the database: ${platform.connections.open} of ${platform.connections.limit}`} value={share(platform.connections.open, platform.connections.limit)} max={1} />
                <p className="text-xs text-fg-secondary">{platform.connections.pool.waiting} waiting.</p>
              </div>
            ) : (
              <Empty>This Orochia release does not report its connections yet.</Empty>
            )}
          </Panel>
        </section>
        <section aria-labelledby="deploy-title">
          <h2 id="deploy-title" className="mb-3 text-sm font-bold text-fg">Deployed</h2>
          <Panel>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-fg-secondary">Console</dt>
              <dd className="font-mono text-fg">{BUILD_INFO.version}{BUILD_INFO.sha ? ` · ${BUILD_INFO.sha}` : ""} · {BUILD_INFO.env}</dd>
              <dt className="text-fg-secondary">Platform</dt>
              <dd className="font-mono text-fg">{platformHealth ? `${platformHealth.version ?? "?"}${platformHealth.commit ? ` · ${platformHealth.commit}` : ""}` : "no answer"}</dd>
            </dl>
          </Panel>
        </section>
      </div>
    </div>
  );
}
