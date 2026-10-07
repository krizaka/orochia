"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Pencil, Trash2, X } from "lucide-react";

export interface StudioVideo {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  visibility: "PUBLIC" | "CONTACTS_ONLY" | "APPROVED_FOLLOWERS_ONLY" | "TIPPED_UNLOCKED";
  minTipAmountCents: number;
  status: "PENDING_UPLOAD" | "PROCESSING" | "READY" | "FAILED";
  removedAt: string | null;
  removalReason: string | null;
  durationSeconds: number;
  viewsCount: number;
  tipsCount: number;
}

const VISIBILITY: Record<StudioVideo["visibility"], string> = {
  PUBLIC: "Public",
  CONTACTS_ONLY: "Contacts only",
  APPROVED_FOLLOWERS_ONLY: "Approved followers",
  TIPPED_UNLOCKED: "Paid unlock",
};

const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function StatusBadge({ v }: { v: StudioVideo }) {
  const [label, cls] = v.removedAt
    ? ["Taken down", "border-rose-500/30 bg-rose-500/10 text-rose-300"]
    : v.status === "READY"
      ? ["Live", "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"]
      : v.status === "FAILED"
        ? ["Encoding failed", "border-rose-500/30 bg-rose-500/10 text-rose-300"]
        : ["Encoding", "border-amber-500/30 bg-amber-500/10 text-amber-300"];
  return <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>{label}</span>;
}

/** The creator's videos: state, figures, and editing (title, description, visibility, price, tags) or deletion. */
export function VideoManager({ videos, onChange }: { videos: StudioVideo[]; onChange: () => void }) {
  const [editing, setEditing] = useState<StudioVideo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget);
    const visibility = f.get("visibility") as StudioVideo["visibility"];
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/videos/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(f.get("title")),
        description: String(f.get("description") || "") || null,
        visibility,
        minTipAmountCents: visibility === "TIPPED_UNLOCKED" ? Math.round(Number(f.get("price")) * 100) : 0,
        tags: String(f.get("tags") || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not save");
      return;
    }
    setEditing(null);
    onChange();
  };

  const remove = async (v: StudioVideo) => {
    if (!window.confirm(`Delete “${v.title}”? It disappears from the platform; your earnings history is kept.`)) return;
    await fetch(`/api/videos/${v.id}`, { method: "DELETE" });
    onChange();
  };

  if (videos.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-12 text-center text-sm text-zinc-400">
        No videos yet. <Link href="/creator/upload" className="text-violet-400 underline">Upload your first one</Link>.
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-3xl p-6 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">State</th>
            <th className="py-2 pr-4">Visibility</th>
            <th className="py-2 pr-4">Duration</th>
            <th className="py-2 pr-4 text-right">Views</th>
            <th className="py-2 pr-4 text-right">Tips</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-zinc-300">
          {videos.map((v) => (
            <tr key={v.id}>
              <td className="py-2.5 pr-4">
                <Link href={`/watch/${v.id}`} className="hover:text-violet-400">{v.title}</Link>
                {v.removedAt && v.removalReason && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-rose-300">
                    <AlertTriangle className="h-3 w-3" /> {v.removalReason}
                  </p>
                )}
              </td>
              <td className="py-2.5 pr-4"><StatusBadge v={v} /></td>
              <td className="py-2.5 pr-4 text-zinc-400">
                {VISIBILITY[v.visibility]}
                {v.visibility === "TIPPED_UNLOCKED" && <span className="ml-1 font-mono text-violet-300">${(v.minTipAmountCents / 100).toFixed(2)}</span>}
              </td>
              <td className="py-2.5 pr-4 font-mono">{duration(v.durationSeconds)}</td>
              <td className="py-2.5 pr-4 text-right font-mono">{v.viewsCount.toLocaleString("en-US")}</td>
              <td className="py-2.5 pr-4 text-right font-mono">{v.tipsCount}</td>
              <td className="py-2.5 text-right">
                {!v.removedAt && (
                  <div className="inline-flex gap-1">
                    <button onClick={() => setEditing(v)} className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-white" aria-label={`Edit ${v.title}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(v)} className="rounded-lg p-2 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300" aria-label={`Delete ${v.title}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Edit video</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-zinc-400 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <label className="block text-xs text-zinc-400">
              Title
              <input name="title" defaultValue={editing.title} required minLength={3} maxLength={255} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none" />
            </label>
            <label className="block text-xs text-zinc-400">
              Description
              <textarea name="description" defaultValue={editing.description ?? ""} maxLength={5000} rows={3} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-zinc-400">
                Visibility
                <select name="visibility" defaultValue={editing.visibility} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white">
                  {Object.entries(VISIBILITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block text-xs text-zinc-400">
                Unlock price (USD, paid unlock)
                <input name="price" type="number" min={1} step={0.5} defaultValue={Math.max(editing.minTipAmountCents / 100, 5)} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white" />
              </label>
            </div>
            <label className="block text-xs text-zinc-400">
              Tags (comma-separated)
              <input name="tags" defaultValue={editing.tags.join(", ")} maxLength={500} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none" />
            </label>
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-zinc-300">Cancel</button>
              <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
