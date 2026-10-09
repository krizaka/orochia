"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Gavel, Pencil, Trash2, Users } from "lucide-react";
import { Button, ConfirmIconButton, Sheet } from "@/components/ui";
import { Rich } from "@/components/Rich";
import { t } from "@/lib/i18n";
import { AudienceEditor } from "../AudienceEditor";
import { StartAuctionSheet } from "../auctions/StartAuctionSheet";
import { CHOOSABLE_VISIBILITIES } from "@/lib/visibility";
import type { VideoVisibility } from "@/lib/visibility";

export interface StudioVideo {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  visibility: VideoVisibility;
  minTipAmountCents: number;
  status: "PENDING_UPLOAD" | "PROCESSING" | "READY" | "FAILED";
  removedAt: string | null;
  removalReason: string | null;
  durationSeconds: number;
  viewsCount: number;
  tipsCount: number;
}

const visibilityLabel = (v: StudioVideo["visibility"]) => t(`publish.audiences.${v}.title`);

const field =
  "mt-1 w-full rounded-xl border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-hidden";
const label = "block text-xs font-semibold text-fg-secondary";
const iconAction = "rounded-lg p-2 text-fg-secondary transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function StatusBadge({ v }: { v: StudioVideo }) {
  const [label, cls] = v.removedAt
    ? [t("studio.status.removed"), "border-danger/30 bg-danger/10 text-danger"]
    : v.status === "READY"
      ? [t("studio.status.published"), "border-success/30 bg-success/10 text-success"]
      : v.status === "FAILED"
        ? [t("studio.status.failed"), "border-danger/30 bg-danger/10 text-danger"]
        : [t("studio.status.encoding"), "border-warning/30 bg-warning/10 text-warning"];
  return <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{label}</span>;
}

/** The creator's videos: state, figures, and editing (title, description, visibility, audience, price, tags) or deletion. */
export function VideoManager({ videos, onChange }: { videos: StudioVideo[]; onChange: () => void }) {
  const [editing, setEditing] = useState<StudioVideo | null>(null);
  const [auctioning, setAuctioning] = useState<StudioVideo | null>(null);
  const [visibility, setVisibility] = useState<StudioVideo["visibility"]>("PUBLIC");
  const edit = (v: StudioVideo) => {
    setEditing(v);
    setVisibility(v.visibility);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget);
    const visibility = (f.get("visibility") as StudioVideo["visibility"] | null) ?? undefined;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/videos/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(f.get("title")),
        description: String(f.get("description") || "") || null,
        visibility,
        minTipAmountCents: visibility === undefined ? undefined : visibility === "TIPPED_UNLOCKED" ? Math.round(Number(f.get("price")) * 100) : 0,
        tags: String(f.get("tags") || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t("studio.saveFailed"));
      return;
    }
    setEditing(null);
    onChange();
  };

  const remove = async (v: StudioVideo) => {
    await fetch(`/api/videos/${v.id}`, { method: "DELETE" });
    onChange();
  };

  if (videos.length === 0) {
    return (
      <div className="rounded-3xl border border-border-default bg-surface-2/40 p-12 text-center text-sm text-fg-secondary">
        <Rich text={t("studio.empty")} slots={{ link: <Link href="/creator/upload" className="font-semibold text-accent underline-offset-2 hover:underline">{t("studio.uploadFirst")}</Link> }} />
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-3xl p-6 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="py-2 pr-4">{t("studio.cols.title")}</th>
            <th className="py-2 pr-4">{t("studio.cols.state")}</th>
            <th className="py-2 pr-4">{t("studio.cols.visibility")}</th>
            <th className="py-2 pr-4">{t("studio.cols.duration")}</th>
            <th className="py-2 pr-4 text-right">{t("studio.cols.views")}</th>
            <th className="py-2 pr-4 text-right">{t("studio.cols.tips")}</th>
            <th className="py-2 text-right">{t("studio.cols.actions")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle text-fg-secondary">
          {videos.map((v) => (
            <tr key={v.id}>
              <td className="py-2.5 pr-4">
                <Link href={`/watch/${v.id}`} className="hover:text-accent">{v.title}</Link>
                {v.removedAt && v.removalReason && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-danger">
                    <AlertTriangle className="h-3 w-3" /> {v.removalReason}
                  </p>
                )}
              </td>
              <td className="py-2.5 pr-4"><StatusBadge v={v} /></td>
              <td className="py-2.5 pr-4 text-fg-secondary">
                {v.visibility === "AUCTION" ? (
                  <Link href={`/watch/${v.id}#auction`} className="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent">
                    <Gavel className="h-3 w-3" aria-hidden /> {visibilityLabel(v.visibility)}
                  </Link>
                ) : (
                  visibilityLabel(v.visibility)
                )}
                {v.visibility === "TIPPED_UNLOCKED" && <span className="ml-1 font-mono text-accent">${(v.minTipAmountCents / 100).toFixed(2)}</span>}
              </td>
              <td className="py-2.5 pr-4 font-mono">{duration(v.durationSeconds)}</td>
              <td className="py-2.5 pr-4 text-right font-mono">{v.viewsCount.toLocaleString("en-US")}</td>
              <td className="py-2.5 pr-4 text-right font-mono">{v.tipsCount}</td>
              <td className="py-2.5 text-right">
                {!v.removedAt && (
                  <div className="inline-flex gap-1">
                    {v.status === "READY" && v.visibility !== "AUCTION" && v.visibility !== "CHALLENGE" && (
                      <button onClick={() => setAuctioning(v)} className={iconAction} aria-label={t("studio.auctionNamed", { title: v.title })} title={t("studio.auctionNamed", { title: v.title })}>
                        <Gavel className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {v.visibility === "INVITED_ONLY" && (
                      <button onClick={() => edit(v)} className={iconAction} aria-label={t("studio.whoCanWatchNamed", { title: v.title })} title={t("studio.whoCanWatchNamed", { title: v.title })}>
                        <Users className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button onClick={() => edit(v)} className={iconAction} aria-label={t("studio.editNamed", { title: v.title })} title={t("studio.editNamed", { title: v.title })}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <ConfirmIconButton label={t("studio.deleteNamed", { title: v.title })} confirmLabel={t("studio.confirmDelete")} onConfirm={() => void remove(v)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </ConfirmIconButton>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t("studio.editTitle")}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
            <Button variant="sensual" type="submit" form="studio-edit" loading={busy}>{t("common.save")}</Button>
          </div>
        }
      >
        {editing && (
          <form id="studio-edit" key={editing.id} onSubmit={save} className="space-y-4">
            <label className={label}>
              {t("studio.title")}
              <input name="title" defaultValue={editing.title} required minLength={3} maxLength={255} className={field} />
            </label>
            <label className={label}>
              {t("studio.description")}
              <textarea name="description" defaultValue={editing.description ?? ""} maxLength={5000} rows={3} className={field} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={label}>
                {t("studio.visibility")}
                {visibility === "AUCTION" || visibility === "CHALLENGE" ? (
                  <span className={`${field} flex items-center gap-1.5 text-fg-secondary`}>
                    <Gavel className="h-3.5 w-3.5" aria-hidden /> {t(visibility === "AUCTION" ? "studio.auctionLocked" : "studio.challengeLocked")}
                  </span>
                ) : (
                  <select name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as StudioVideo["visibility"])} className={field}>
                    {CHOOSABLE_VISIBILITIES.map((value) => <option key={value} value={value}>{visibilityLabel(value)}</option>)}
                  </select>
                )}
              </label>
              {visibility === "TIPPED_UNLOCKED" && (
                <label className={label}>
                  {t("studio.price")}
                  <input name="price" type="number" min={1} step={0.5} defaultValue={Math.max(editing.minTipAmountCents / 100, 5)} className={field} />
                </label>
              )}
            </div>
            <label className={label}>
              {t("studio.tags")}
              <input name="tags" defaultValue={editing.tags.join(", ")} maxLength={500} className={field} />
            </label>
            {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          </form>
        )}
        {/* Outside the form: the audience editor saves on its own (and has its own form). */}
        {editing && visibility === "INVITED_ONLY" && (
          <div className={`${label} mt-4`}>
            {t("studio.audience")}
            <div className="mt-1">
              <AudienceEditor endpoint={`/api/videos/${editing.id}/audience`} />
            </div>
          </div>
        )}
      </Sheet>

      {auctioning && <StartAuctionSheet video={auctioning} open onClose={() => setAuctioning(null)} />}
    </div>
  );
}
