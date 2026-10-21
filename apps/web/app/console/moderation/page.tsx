import { ReportsTable } from "@/console/components/tables";
import { Empty, filter, PageTitle } from "@/console/components/ui";
import { orochia } from "@/console/lib/orochia";

interface Report {
  id: string;
  videoId: string | null;
  messageId: string | null;
  videoTitle: string;
  reason: string;
  details: string;
  reporterEmail: string;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED";
  createdAt: string;
}

export default async function ModerationPage(props: { searchParams: Promise<{ status?: string }> }) {
  const searchParams = await props.searchParams;
  const status = searchParams.status === "all" ? "" : searchParams.status ?? "OPEN";
  const { reports } = await orochia<{ reports: Report[] }>(`/api/admin/reports${status ? `?status=${status}` : ""}`);
  return (
    <div>
      <PageTitle title="Content Reports" subtitle="Suspected minors and non-consensual content are listed first" />
      <div className="mb-4 flex gap-2 text-xs">
        {["OPEN", "IN_REVIEW", "RESOLVED", "all"].map((s) => (
          <a key={s} href={`/moderation?status=${s}`} aria-current={(status || "all") === s ? "page" : undefined} className={filter((status || "all") === s)}>
            {s.replace("_", " ").toLowerCase()}
          </a>
        ))}
      </div>
      {reports.length === 0 ? (
        <Empty>No report in this state.</Empty>
      ) : (
        <ReportsTable rows={reports} appUrl={process.env.NEXT_PUBLIC_OPERATOR_PLATFORM_URL || "http://localhost:3000"} />
      )}
    </div>
  );
}
