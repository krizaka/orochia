import { BarChart } from "@krizaka/charts/bar";
import { AreaChart } from "@krizaka/charts/line";
import { DonutChart } from "@krizaka/charts/pie";
import { Meter } from "@krizaka/ui/meter";
import Link from "next/link";

import { cn, Empty, PageTitle, Panel, Stat } from "@/console/components/ui";
import { money, orochia } from "@/console/lib/orochia";

interface Overview {
  treasury: {
    grossCents: number;
    platformFeeCents: number;
    creatorNetCents: number;
    creditsCount: number;
    payoutsRequestedCents: number;
    payoutsSettledCents: number;
    protocolRakePercent: number;
  };
  catalogue: { videosByStatus: Record<string, number>; totalViews: number };
  queues: { openReports: number; creatorsAwaitingVerification: number; payoutsInProgress: number };
  /** 12 months, oldest first — absent from an Orochia older than this console. */
  trends?: { month: string; grossCents: number; feeCents: number; netCents: number; payments: number; reportsOpened: number; reportsResolved: number }[];
}

const USD = { style: "money", currency: "USD" } as const;

const STATUS_LABEL: Record<string, string> = {
  READY: "Ready",
  PROCESSING: "Encoding",
  PENDING_UPLOAD: "Uploading",
  HELD: "Held (no space)",
  FAILED: "Failed",
};

export default async function OverviewPage() {
  const { data } = await orochia<{ data: Overview }>("/api/admin/overview");
  const { treasury: t, catalogue: c, queues: q, trends = [] } = data;
  const queues = [
    { href: "/moderation", label: "Open content reports", value: q.openReports, urgent: q.openReports > 0 },
    { href: "/compliance", label: "Creators awaiting 2257 verification", value: q.creatorsAwaitingVerification, urgent: false },
    { href: "/treasury", label: "Payouts in progress", value: q.payoutsInProgress, urgent: false },
  ];
  const revenue = trends.some((m) => m.grossCents > 0) ? trends : [];
  const reports = trends.some((m) => m.reportsOpened + m.reportsResolved > 0) ? trends : [];
  const catalogue = Object.entries(c.videosByStatus)
    .filter(([, n]) => n > 0)
    .map(([status, count]) => ({ status: STATUS_LABEL[status] ?? status, count }));

  return (
    <div>
      <PageTitle title="Overview" subtitle="Live figures from the Orochia ledger and catalogue" />
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {queues.map((queue) => (
          <Link
            key={queue.href}
            href={queue.href}
            className={cn("rounded-xl border p-5 shadow-md transition-colors hover:border-border-strong", queue.urgent ? "border-danger/40 bg-danger/10" : "border-border-default bg-surface-2")}
          >
            <span className="text-[11px] font-mono uppercase tracking-wider text-fg-secondary">{queue.label}</span>
            <p className={cn("mt-2 font-display text-3xl font-black tabular-nums", queue.urgent ? "text-fg-danger" : "text-fg")}>{queue.value}</p>
          </Link>
        ))}
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross volume" value={money(t.grossCents)} hint={`${t.creditsCount} payments`} />
        <Stat label="Platform fees" value={money(t.platformFeeCents)} hint={`${t.protocolRakePercent}% of gross`} tone="success" />
        <Stat label="Ready videos" value={c.videosByStatus.READY ?? 0} hint={`${(c.videosByStatus.PROCESSING ?? 0) + (c.videosByStatus.PENDING_UPLOAD ?? 0)} in the pipeline`} />
        <Stat label="Total views" value={c.totalViews.toLocaleString("en-US")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Panel>
            <AreaChart
              title="Platform revenue, last 12 months"
              description="Every creator credit in the ledger: what went to the creators and what the platform kept."
              data={revenue}
              x="month"
              xFormat="month"
              xLabel="Month"
              series={[
                { key: "netCents", label: "To creators" },
                { key: "feeCents", label: "Platform fees", color: "success" },
              ]}
              stacked
              format={USD}
              height={260}
              exportable={["csv", "png"]}
              empty="No payment in the last 12 months."
            />
          </Panel>
        </div>
        <Panel className="space-y-6">
          <Meter
            label="Split of the gross volume"
            showLabel
            max={Math.max(1, t.grossCents)}
            parts={[
              { label: "To creators", value: t.creatorNetCents, valueText: money(t.creatorNetCents) },
              { label: "Platform", value: t.platformFeeCents, valueText: money(t.platformFeeCents) },
            ]}
          />
          <Meter
            label="Payouts: paid and waiting"
            showLabel
            max={Math.max(1, t.payoutsSettledCents + t.payoutsRequestedCents)}
            parts={[
              { label: "Paid out", value: t.payoutsSettledCents, valueText: money(t.payoutsSettledCents) },
              { label: "Waiting", value: t.payoutsRequestedCents, valueText: money(t.payoutsRequestedCents) },
            ]}
          />
          <DonutChart
            title="Catalogue by state"
            data={catalogue}
            label="status"
            value="count"
            format="integer"
            centerLabel="videos"
            height={200}
            empty="No video yet."
          />
        </Panel>
        <div className="xl:col-span-3">
          {reports.length === 0 ? (
            <Empty>No content report in the last 12 months.</Empty>
          ) : (
            <Panel>
              <BarChart
                title="Content reports, last 12 months"
                description="Opened (by members and visitors) and resolved (by an operator) each month."
                data={reports}
                x="month"
                xFormat="month"
                xLabel="Month"
                series={[
                  { key: "reportsOpened", label: "Opened", color: "warning" },
                  { key: "reportsResolved", label: "Resolved", color: "success" },
                ]}
                format="integer"
                height={220}
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
