import { CatalogueTable } from "@/console/components/tables";
import { button, Empty, filter, PageTitle, Stat } from "@/console/components/ui";
import { orochia } from "@/console/lib/orochia";

interface Catalogue {
  videosByStatus: Record<string, number>;
  totalViews: number;
}

interface CatalogueVideo {
  id: string;
  title: string;
  status: string;
  visibility: string;
  creatorUsername: string;
  viewsCount: number;
  tipsCount: number;
  createdAt: string;
  removedAt: string | null;
  removalReason: string | null;
  openReports: number;
}

const STATES = ["all", "listed", "removed"] as const;

export default async function CataloguePage(props: { searchParams: Promise<{ state?: string; q?: string }> }) {
  const searchParams = await props.searchParams;
  const state = STATES.includes(searchParams.state as (typeof STATES)[number]) ? searchParams.state! : "all";
  const q = (searchParams.q ?? "").slice(0, 100);
  const params = new URLSearchParams({ state, ...(q ? { q } : {}) });
  const [{ data }, { videos }] = await Promise.all([
    orochia<{ data: Catalogue }>("/api/bunny/analytics"),
    orochia<{ videos: CatalogueVideo[] }>(`/api/admin/videos?${params}`),
  ]);
  const s = data.videosByStatus;
  const appUrl = process.env.NEXT_PUBLIC_OPERATOR_PLATFORM_URL || "http://localhost:3000";

  return (
    <div>
      <PageTitle
        title="Catalogue"
        subtitle="Every video, its encoding state and open reports. A takedown hides the video everywhere and refuses its playback; it is recorded with its reason and can be reversed."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Stat label="Ready" value={s.READY ?? 0} tone="success" />
        <Stat label="Processing" value={s.PROCESSING ?? 0} />
        <Stat label="Awaiting upload" value={s.PENDING_UPLOAD ?? 0} />
        <Stat label="Failed" value={s.FAILED ?? 0} tone="danger" />
        <Stat label="Total views" value={data.totalViews.toLocaleString("en-US")} />
      </div>

      <form className="mb-4 flex flex-wrap gap-2 text-xs" action="/catalogue">
        {STATES.map((st) => (
          <a key={st} href={`/catalogue?state=${st}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={state === st ? "page" : undefined} className={filter(state === st)}>
            {st}
          </a>
        ))}
        <input type="hidden" name="state" value={state} />
        <input name="q" defaultValue={q} placeholder="Title or creator" className="ml-auto rounded-lg border border-border-default bg-surface-2 px-3 py-1 text-xs text-fg" />
        <button className={button}>Search</button>
      </form>

      {videos.length === 0 ? (
        <Empty>No video matches.</Empty>
      ) : (
        <CatalogueTable rows={videos} appUrl={appUrl} />
      )}
    </div>
  );
}
