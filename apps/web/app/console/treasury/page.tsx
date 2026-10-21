import { ClosedPayoutsTable, OpenPayoutsTable } from "@/console/components/tables";
import { Empty, PageTitle, Stat } from "@/console/components/ui";
import { money,orochia } from "@/console/lib/orochia";

interface Treasury {
  protocolRakePercent: number;
  grossCents: number;
  platformFeeCents: number;
  creatorNetCents: number;
  creditsCount: number;
  payoutsRequestedCents: number;
  payoutsSettledCents: number;
}

interface Payout {
  id: string;
  amountCents: number;
  status: string;
  payoutMethod: string;
  payoutDestination: string;
  txHashOrReference: string | null;
  failureReason: string | null;
  createdAt: string;
  creatorUsername: string;
}

export default async function TreasuryPage() {
  const [{ data: t }, { payouts }] = await Promise.all([
    orochia<{ data: Treasury }>("/api/platform/treasury"),
    orochia<{ payouts: Payout[] }>("/api/admin/payouts"),
  ]);
  const open = payouts.filter((p) => !["SETTLED", "FAILED"].includes(p.status));
  const closed = payouts.filter((p) => ["SETTLED", "FAILED"].includes(p.status));

  return (
    <div>
      <PageTitle title="Treasury & Payouts" subtitle="Figures computed from the ledger; payouts are settled by an operator" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <Stat label="Gross volume" value={money(t.grossCents)} hint={`${t.creditsCount} payments`} />
        <Stat label="Platform fees" value={money(t.platformFeeCents)} hint={`${t.protocolRakePercent}% of gross`} tone="success" />
        <Stat label="Creator earnings" value={money(t.creatorNetCents)} hint="net of fees" />
        <Stat label="Payouts in progress" value={money(t.payoutsRequestedCents)} tone="warning" />
        <Stat label="Payouts settled" value={money(t.payoutsSettledCents)} />
      </div>

      <h2 className="mb-3 text-sm font-bold text-fg">Payouts to process ({open.length})</h2>
      {open.length === 0 ? (
        <Empty>No payout waiting.</Empty>
      ) : (
        <OpenPayoutsTable rows={open} />
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-sm font-bold text-fg">History</h2>
          <ClosedPayoutsTable rows={closed} />
        </>
      )}
    </div>
  );
}
