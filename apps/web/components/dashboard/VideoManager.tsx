"use client";

import { AlertTriangle, Gavel, Pencil, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useState } from "react";

import { Rich } from "@/components/Rich";
import {
  Badge,
  ConfirmButton,
  DataTable,
  EmptyState,
  IconButton,
  undoToast,
} from "@/components/ui";
import { t } from "@/lib/i18n";
import { compact, money } from "@/lib/money";
import type { VideoVisibility } from "@/lib/visibility";

import { StartAuctionSheet } from "../auctions/StartAuctionSheet";
import { PlayVideoSheet } from "./PlayVideoSheet";
import { VideoEditSheet } from "./VideoEditSheet";

export interface StudioVideo {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  visibility: VideoVisibility;
  minTipAmountCents: number;
  status: "PENDING_UPLOAD" | "PROCESSING" | "READY" | "FAILED" | "HELD";
  removedAt: string | null;
  removalReason: string | null;
  durationSeconds: number;
  viewsCount: number;
  tipsCount: number;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

const SORTABLE = ["title", "durationSeconds", "viewsCount", "tipsCount"];

const visibilityLabel = (v: StudioVideo["visibility"]) => t(`publish.audiences.${v}.title`);

const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function StatusBadge({ v }: { v: StudioVideo }) {
  const [label, tone] = v.removedAt
    ? [t("studio.status.removed"), "danger" as const]
    : v.status === "READY"
      ? [t("studio.status.published"), "success" as const]
      : v.status === "FAILED"
        ? [t("studio.status.failed"), "danger" as const]
        : v.status === "HELD"
          ? [t("studio.status.held"), "warning" as const]
          : [t("studio.status.encoding"), "warning" as const];
  return <Badge size="sm" tone={tone} dot>{label}</Badge>;
}

/** The creator's videos on `DataTable` (sortable title, duration, views, tips — the sort in the address; cards on a phone): state, figures, and editing (title, description, visibility, audience, price, tags) or deletion. */
export function VideoManager({ videos, onChange }: { videos: StudioVideo[]; onChange: () => void }) {
  const [editing, setEditing] = useState<StudioVideo | null>(null);
  const [playing, setPlaying] = useState<StudioVideo | null>(null);
  const [auctioning, setAuctioning] = useState<StudioVideo | null>(null);
  const edit = (v: StudioVideo) => setEditing(v);

  // Withdrawn after the undo window: the row leaves at once, the DELETE goes when the toast does.
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const remove = (v: StudioVideo) => {
    setLeaving((s) => new Set(s).add(v.id));
    undoToast(t("studio.withdrawn", { title: v.title }), {
      onUndo: () => setLeaving((s) => { const next = new Set(s); next.delete(v.id); return next; }),
      onCommit: () => void fetch(`/api/videos/${v.id}`, { method: "DELETE" }).finally(onChange),
    });
  };
  const shown = videos.filter((v) => !leaving.has(v.id));

  // The sort is the address (`?tab=uploads&vsort=viewsCount-desc`), like every view of the app.
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [sortColumn, sortDirection] = (params.get("vsort") ?? "").split("-");
  const sort = SORTABLE.includes(sortColumn) ? { column: sortColumn, direction: sortDirection === "asc" ? ("ascending" as const) : ("descending" as const) } : null;
  const setSort = (next: { column: string; direction: "ascending" | "descending" } | null) => {
    const query = new URLSearchParams(params.toString());
    if (next) query.set("vsort", `${next.column}-${next.direction === "ascending" ? "asc" : "desc"}`);
    else query.delete("vsort");
    router.replace(`${pathname}?${query}`, { scroll: false });
  };

  if (shown.length === 0) {
    return (
      <EmptyState
        bird="duck"
        mood="welcome"
        className="rounded-3xl bg-surface-2/40"
        title={<Rich text={t("studio.empty")} slots={{ link: <Link href="/creator/upload" className="font-semibold text-fg-accent underline-offset-2 hover:underline">{t("studio.uploadFirst")}</Link> }} />}
      />
    );
  }

  return (
    <div className="glass-panel rounded-3xl p-4 sm:p-6">
      <DataTable
        caption={t("studio.caption")}
        rows={shown}
        getRowId={(v) => v.id}
        density="compact"
        sort={sort}
        onSortChange={setSort}
        columns={[
          {
            id: "thumbnail",
            header: t("studio.cols.preview"),
            cell: (v) => (
              <button
                type="button"
                disabled={Boolean(v.removedAt) || v.status !== "READY"}
                onClick={() => setPlaying(v)}
                aria-label={t("owner.play", { title: v.title })}
                className="relative block h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-3 ring-1 ring-border-default transition-shadow enabled:hover:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                {v.thumbnailUrl && <img src={v.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </button>
            ),
          },
          {
            id: "title",
            header: t("studio.cols.title"),
            card: "title",
            sortable: true,
            cell: (v) => (
              <>
                <Link href={`/watch/${v.id}`} className="text-fg hover:text-fg-accent">{v.title}</Link>
                {v.removedAt && v.removalReason && (
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-fg-danger">
                    <AlertTriangle className="h-3 w-3" /> {v.removalReason}
                  </span>
                )}
              </>
            ),
          },
          { id: "status", header: t("studio.cols.state"), cell: (v) => <StatusBadge v={v} /> },
          {
            id: "visibility",
            header: t("studio.cols.visibility"),
            cell: (v) => (
              <span className="text-xs text-fg-secondary">
                {v.visibility === "AUCTION" ? (
                  <Link href={`/watch/${v.id}#auction`} className="inline-flex items-center gap-1 font-semibold text-fg-accent">
                    <Gavel className="h-3 w-3" aria-hidden /> {visibilityLabel(v.visibility)}
                  </Link>
                ) : (
                  visibilityLabel(v.visibility)
                )}
                {v.visibility === "TIPPED_UNLOCKED" && <span className="ml-1 font-mono text-fg-accent">{money(v.minTipAmountCents)}</span>}
              </span>
            ),
          },
          { id: "durationSeconds", header: t("studio.cols.duration"), sortable: true, cell: (v) => <span className="font-mono text-xs">{duration(v.durationSeconds)}</span> },
          { id: "viewsCount", header: t("studio.cols.views"), sortable: true, align: "end", cell: (v) => <span className="font-mono text-xs">{compact(v.viewsCount)}</span> },
          { id: "tipsCount", header: t("studio.cols.tips"), sortable: true, align: "end", cell: (v) => <span className="font-mono text-xs">{v.tipsCount}</span> },
          {
            id: "actions",
            header: t("studio.cols.actions"),
            align: "end",
            cell: (v) =>
              !v.removedAt && (
                <div className="inline-flex gap-1">
                  {v.status === "READY" && v.visibility !== "AUCTION" && v.visibility !== "CHALLENGE" && (
                    <IconButton size="sm" shape="rounded" className="h-8 w-8" onClick={() => setAuctioning(v)} label={t("studio.auctionNamed", { title: v.title })}>
                      <Gavel className="h-3.5 w-3.5" aria-hidden />
                    </IconButton>
                  )}
                  {v.visibility === "INVITED_ONLY" && (
                    <IconButton size="sm" shape="rounded" className="h-8 w-8" onClick={() => edit(v)} label={t("studio.whoCanWatchNamed", { title: v.title })}>
                      <Users className="h-3.5 w-3.5" aria-hidden />
                    </IconButton>
                  )}
                  <IconButton size="sm" shape="rounded" className="h-8 w-8" onClick={() => edit(v)} label={t("studio.editNamed", { title: v.title })}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </IconButton>
                  <ConfirmButton size="sm" label={t("studio.deleteNamed", { title: v.title })} confirmLabel={t("studio.confirmDelete")} onConfirm={() => remove(v)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </ConfirmButton>
                </div>
              ),
          },
        ]}
      />

      <PlayVideoSheet video={playing} onClose={() => setPlaying(null)} />
      <VideoEditSheet video={editing} onClose={() => setEditing(null)} onSaved={onChange} />

      {auctioning && <StartAuctionSheet video={auctioning} open onClose={() => setAuctioning(null)} />}
    </div>
  );
}
