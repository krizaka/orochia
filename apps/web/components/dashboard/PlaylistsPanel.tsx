"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { AudienceEditor } from "../AudienceEditor";
import { COLLECTION_AUDIENCES, CollectionAudienceBadge, audienceOf, type CollectionVisibility } from "../CollectionAudience";
import { t } from "@/lib/i18n";
import { ConfirmIconButton } from "@/components/ui";

interface Collection {
  id: string;
  title: string;
  description: string | null;
  visibility: CollectionVisibility;
  itemsCount: number;
  membersCount: number;
  listsCount: number;
}

const field =
  "rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-hidden light:bg-slate-50 light:border-black/10 light:placeholder:text-slate-400 light:text-slate-900";

/** Your collections — create, choose who opens each, invite accounts, delete — and those shared with you. */
export function PlaylistsPanel() {
  const [lists, setLists] = useState<Collection[] | null>(null);
  const [shared, setShared] = useState<(Collection & { ownerUsername: string })[] | null>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<CollectionVisibility>("PRIVATE");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [mine, invited] = await Promise.all([
      fetch("/api/playlists", { cache: "no-store" }),
      fetch("/api/playlists/shared", { cache: "no-store" }),
    ]);
    if (mine.ok) setLists(((await mine.json()) as { playlists: Collection[] }).playlists);
    if (invited.ok) setShared(((await invited.json()) as { playlists: (Collection & { ownerUsername: string })[] }).playlists);
  }, []);
  useEffect(() => void load(), [load]);

  const send = async (url: string, method: string, body?: object) => {
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) setError(t("playlistsPanel.saveFailed"));
    await load();
    return res.ok;
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void send("/api/playlists", "POST", { title: title.trim(), visibility }).then((ok) => ok && setTitle(""));
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("playlistsPanel.titlePlaceholder")} className={`${field} flex-1`} />
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as CollectionVisibility)} aria-label={t("playlistsPanel.whoOpens")} className={field}>
          {COLLECTION_AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <button disabled={!title.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-xs font-bold text-white disabled:opacity-40">
          <Plus className="h-4 w-4" /> {t("common.create")}
        </button>
      </form>
      <p className="-mt-3 text-[11px] text-zinc-500 light:text-slate-500">
        {audienceOf(visibility).hint} {t("playlistsPanel.perVideo")}
      </p>
      {error && <p className="text-xs text-rose-300">{error}</p>}

      {lists === null ? (
        <p className="text-xs text-zinc-500 light:text-slate-500">{t("playlistsPanel.loading")}</p>
      ) : lists.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-12 text-center text-sm text-zinc-400 light:bg-slate-50 light:border-black/10 light:text-slate-500">
          {t("playlistsPanel.empty")}
        </div>
      ) : (
        <ul className="glass-panel divide-y divide-white/5 rounded-3xl px-5 light:divide-black/5">
          {lists.map((p) => (
            <li key={p.id} className="py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href={`/playlists/${p.id}`} className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white hover:text-violet-300 light:text-slate-900">{p.title}</span>
                  <span className="text-[11px] font-mono text-zinc-500 light:text-slate-500">
                    {t("playlistsPanel.videos", { count: p.itemsCount })}
                    {p.visibility === "INVITED_ONLY" && t("playlistsPanel.invitedMeta", { members: p.membersCount, lists: p.listsCount })}
                  </span>
                </Link>
                <div className="flex items-center gap-1">
                  <select
                    value={p.visibility}
                    onChange={(e) => void send(`/api/playlists/${p.id}`, "PATCH", { visibility: e.target.value })}
                    aria-label={t("playlistsPanel.whoOpensNamed", { title: p.title })}
                    className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-[11px] font-semibold text-zinc-200 focus:border-violet-500 focus:outline-hidden light:bg-slate-50 light:border-black/10 light:text-slate-700"
                  >
                    {COLLECTION_AUDIENCES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <ConfirmIconButton
                    label={t("playlistsPanel.delete", { title: p.title })}
                    confirmLabel={t("playlistsPanel.confirmDelete")}
                    onConfirm={() => void send(`/api/playlists/${p.id}`, "DELETE")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </ConfirmIconButton>
                </div>
              </div>
              {p.visibility === "INVITED_ONLY" && (
                <div className="mt-3">
                  <AudienceEditor endpoint={`/api/playlists/${p.id}/members`} onChange={load} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {shared && shared.length > 0 && (
        <section>
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 light:text-slate-500">{t("playlistsPanel.shared")}</h3>
          <ul className="glass-panel divide-y divide-white/5 rounded-3xl px-5 light:divide-black/5">
            {shared.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3.5">
                <Link href={`/playlists/${p.id}`} className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white hover:text-violet-300 light:text-slate-900">{p.title}</span>
                  <span className="text-[11px] font-mono text-zinc-500 light:text-slate-500">
                    {t("playlistsPanel.sharedMeta", { owner: p.ownerUsername, count: p.itemsCount })}
                  </span>
                </Link>
                <CollectionAudienceBadge visibility={p.visibility} className="text-[11px] text-zinc-400 light:text-slate-500" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
