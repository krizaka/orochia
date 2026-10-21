import { Activity, Cpu, RefreshCw } from "lucide-react";

import { syncExplorer } from "@/app/console/actions";
import { ConfirmDialog } from "@/console/components/ConfirmDialog";
import { ExplorerRunsTable } from "@/console/components/tables";
import { Empty, PageTitle, Panel, Stat } from "@/console/components/ui";
import { coverage } from "@/console/lib/explorer-view";
import { whenLong } from "@/console/lib/format";
import { orochia } from "@/console/lib/orochia";

interface ExplorerStatus {
  configured: boolean;
  engine: string | null;
  breaker: { open: boolean; failures: number; reopensAt: string | null };
  discoverable: number;
  embedded: number;
  models: string[];
  runs: { id: string; kind: string; orazakaRunId: string | null; model: string | null; inputs: number; promptTokens: number; status: string; durationMs: number; createdAt: string }[];
}

const when = whenLong;

/**
 * The Explorer on Orazaka: proof that Orochia's search and recommendations run on the engine — the engine's host, the
 * vectors kept, and each call with the run id Orazaka answered (the `embedding.run runId=…` line of Orazaka's logs).
 * Counts, ids and timings only: no search text, no vector, no key.
 */
export default async function ExplorerPage() {
  const { data: s } = await orochia<{ data: ExplorerStatus }>("/api/admin/explorer");
  const cover = coverage(s.embedded, s.discoverable);
  const answered = s.runs.filter((r) => r.status === "OK").length;

  return (
    <div>
      <PageTitle
        title="Explorer on Orazaka"
        subtitle="Search by meaning and similar videos run on Orazaka's embeddings — never on a model provider. Only the titles, tags and descriptions of public videos are sent. This page is the proof of use."
        actions={
          <ConfirmDialog
            action={syncExplorer}
            trigger={{ label: "Index now", tone: "primary", icon: <RefreshCw className="h-3.5 w-3.5" aria-hidden /> }}
            tone="primary"
            title="Index the public videos"
            description="Sends the title, tags and description of the public videos that have no vector yet (200 at most) to Orazaka and keeps the vectors. It runs by itself every ten minutes."
            confirmLabel="Index"
          />
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Engine" value={s.configured ? (s.engine ?? "configured") : "Not configured"} hint={s.configured ? (s.models.length ? `model ${s.models.join(", ")}` : "no vector yet") : "AI_ENGINE_URL / AI_ENGINE_API_KEY"} tone={s.configured ? "success" : "warning"} />
        <Stat label="Public videos with a vector" value={`${s.embedded} / ${s.discoverable}`} hint={cover.percent === null ? "no public video yet" : `${cover.percent} %`} tone={cover.tone} />
        <Stat label="Circuit" value={s.breaker.open ? "Paused" : "Closed"} hint={s.breaker.open ? `retries ${s.breaker.reopensAt ? when(s.breaker.reopensAt) : "soon"}` : `${s.breaker.failures} recent failure(s)`} tone={s.breaker.open ? "warning" : "default"} />
        <Stat label="Recent calls answered" value={`${answered} / ${s.runs.length}`} hint="the last 25" tone={s.runs.length > 0 && answered === s.runs.length ? "success" : "default"} />
      </div>

      <section aria-labelledby="runs-title">
        <h2 id="runs-title" className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
          <Activity className="h-4 w-4 text-fg-accent" aria-hidden /> Calls to Orazaka
        </h2>
        {s.runs.length === 0 ? (
          <Empty icon={<Cpu className="h-5 w-5" aria-hidden />}>{s.configured ? "No call yet — index the public videos, or run a search on Orochia." : "Orazaka is not configured: the Explorer is full-text search alone."}</Empty>
        ) : (
          <Panel>
            <ExplorerRunsTable rows={s.runs} />
            <p className="mt-3 text-xs text-fg-secondary">
              The full run id is in the cell&apos;s tooltip and in Orazaka&apos;s logs (<span className="font-mono">embedding.run runId=…</span>). A failed call leaves no id: the search it belonged to was answered by full-text search alone.
            </p>
          </Panel>
        )}
      </section>
    </div>
  );
}
