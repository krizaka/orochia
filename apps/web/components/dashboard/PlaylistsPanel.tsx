"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { AudienceEditor } from "../AudienceEditor";
import { COLLECTION_AUDIENCES, CollectionAudienceBadge, audienceOf, type CollectionVisibility } from "../CollectionAudience";
import { t } from "@/lib/i18n";
import { Button, cn, ConfirmIconButton, Input, Select } from "@/components/ui";

interface Collection {
  id: string;
  title: string;
  description: string | null;
  visibility: CollectionVisibility;
  itemsCount: number;
  membersCount: number;
  listsCount: number;
}

const field = "h-auto rounded-2xl bg-surface-2/80 px-4 py-3";

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
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={t("playlistsPanel.titlePlaceholder")} className={cn(field, "flex-1")} />
        <span className="sm:w-56">
        <Select value={visibility} onChange={(e) => setVisibility(e.target.value as CollectionVisibility)} aria-label={t("playlistsPanel.whoOpens")} className={cn(field, "pr-9")}>
          {COLLECTION_AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
        </span>
        <Button type="submit" variant="sensual" shape="rounded" disabled={!title.trim()} className="h-auto rounded-2xl px-5 py-3 text-xs font-bold">
          <Plus className="h-4 w-4" aria-hidden /> {t("common.create")}
        </Button>
      </form>
      <p className="-mt-3 text-[11px] text-fg-muted">
        {audienceOf(visibility).hint} {t("playlistsPanel.perVideo")}
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}

      {lists === null ? (
        <p className="text-xs text-fg-muted">{t("playlistsPanel.loading")}</p>
      ) : lists.length === 0 ? (
        <div className="rounded-3xl border border-border-default bg-surface-2/40 p-12 text-center text-sm text-fg-secondary">
          {t("playlistsPanel.empty")}
        </div>
      ) : (
        <ul className="glass-panel divide-y divide-border-subtle rounded-3xl px-5">
          {lists.map((p) => (
            <li key={p.id} className="py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href={`/playlists/${p.id}`} className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-fg hover:text-accent">{p.title}</span>
                  <span className="text-[11px] font-mono text-fg-muted">
                    {t("playlistsPanel.videos", { count: p.itemsCount })}
                    {p.visibility === "INVITED_ONLY" && t("playlistsPanel.invitedMeta", { members: p.membersCount, lists: p.listsCount })}
                  </span>
                </Link>
                <div className="flex items-center gap-1">
                  <Select
                    value={p.visibility}
                    onChange={(e) => void send(`/api/playlists/${p.id}`, "PATCH", { visibility: e.target.value })}
                    aria-label={t("playlistsPanel.whoOpensNamed", { title: p.title })}
                    className="h-8 rounded-lg pl-2 text-[11px] font-semibold"
                  >
                    {COLLECTION_AUDIENCES.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </Select>
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
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-fg-muted">{t("playlistsPanel.shared")}</h3>
          <ul className="glass-panel divide-y divide-border-subtle rounded-3xl px-5">
            {shared.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3.5">
                <Link href={`/playlists/${p.id}`} className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-fg hover:text-accent">{p.title}</span>
                  <span className="text-[11px] font-mono text-fg-muted">
                    {t("playlistsPanel.sharedMeta", { owner: p.ownerUsername, count: p.itemsCount })}
                  </span>
                </Link>
                <CollectionAudienceBadge visibility={p.visibility} className="text-[11px] text-fg-secondary" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
