import { AuctionsTable } from "@/console/components/tables";
import { Empty, filter, PageTitle, Stat } from "@/console/components/ui";
import { money,orochia } from "@/console/lib/orochia";

interface AdminAuction {
  id: string;
  status: "OPEN" | "AWAITING_DECISION" | "SOLD" | "DECLINED" | "UNSOLD" | "CANCELLED";
  rights: "WATCH" | "DOWNLOAD";
  settlement: "CREATOR_DECIDES" | "HIGHEST_BID";
  startingPriceCents: number;
  highestBidCents: number;
  bidsCount: number;
  startsAt: string;
  endsAt: string;
  decisionDeadline: string | null;
  cancelReason: string | null;
  videoId: string;
  videoTitle: string;
  creatorUsername: string;
  leaderUsername: string | null;
}

const STATUSES = ["all", "OPEN", "AWAITING_DECISION", "SOLD", "DECLINED", "UNSOLD", "CANCELLED"] as const;
const LABEL: Record<string, string> = { all: "All", OPEN: "Open", AWAITING_DECISION: "Awaiting decision", SOLD: "Sold", DECLINED: "Declined", UNSOLD: "No bids", CANCELLED: "Cancelled" };


export default async function AuctionsPage(props: { searchParams: Promise<{ status?: string }> }) {
  const { status: asked } = await props.searchParams;
  const status = (STATUSES as readonly string[]).includes(asked ?? "") ? asked! : "all";
  const [{ auctions: all }, { auctions }] = await Promise.all([
    orochia<{ auctions: AdminAuction[] }>("/api/admin/auctions"),
    status === "all" ? Promise.resolve({ auctions: null }) : orochia<{ auctions: AdminAuction[] }>(`/api/admin/auctions?status=${status}`),
  ]);
  const list = auctions ?? all;
  const count = (s: string) => all.filter((a) => a.status === s).length;
  const soldVolume = all.filter((a) => a.status === "SOLD").reduce((sum, a) => sum + a.highestBidCents, 0);
  const held = all.filter((a) => a.status === "OPEN" || a.status === "AWAITING_DECISION").reduce((sum, a) => sum + a.highestBidCents, 0);
  const appUrl = process.env.NEXT_PUBLIC_OPERATOR_PLATFORM_URL || "http://localhost:3000";

  return (
    <div>
      <PageTitle
        title="Auctions"
        subtitle="Every auction, its money and its outcome. Bids are credits held while they lead; cancelling an auction releases the leading bid and gives the video its previous audience back."
      />
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Open" value={count("OPEN")} tone="danger" />
        <Stat label="Awaiting decision" value={count("AWAITING_DECISION")} tone="warning" />
        <Stat label="Sold" value={count("SOLD")} tone="success" />
        <Stat label="Sales volume" value={money(soldVolume)} hint="winning bids, gross" />
        <Stat label="Credits held" value={money(held)} hint="behind leading bids" />
      </div>

      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <a
            key={s}
            href={s === "all" ? "/auctions" : `/auctions?status=${s}`}
            aria-current={status === s ? "page" : undefined}
            className={filter(status === s)}
          >
            {LABEL[s]}
            {s !== "all" && <span className="ml-1.5 font-mono text-[10px] opacity-70">{count(s)}</span>}
          </a>
        ))}
      </nav>

      {list.length === 0 ? (
        <Empty>No auction {status === "all" ? "yet" : `in “${LABEL[status]}”`}.</Empty>
      ) : (
        <AuctionsTable rows={list} appUrl={appUrl} />
      )}
    </div>
  );
}
