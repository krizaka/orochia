"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ListPlus, Plus } from "lucide-react";
import { Button, buttonVariants, IconButton, Input } from "@/components/ui";
import { t } from "@/lib/i18n";
import { audienceOf, type CollectionVisibility } from "./CollectionAudience";
import { useAuth } from "@/lib/auth-context";

interface PlaylistCard {
  id: string;
  title: string;
  visibility: CollectionVisibility;
  itemsCount: number;
}

/** "Save to collection": pick one of your collections or create one (private), then the video is appended. */
export function SaveToPlaylist({ videoId }: { videoId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<PlaylistCard[] | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    fetch("/api/playlists", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { playlists?: PlaylistCard[] }) => setLists(d.playlists ?? []))
      .catch(() => setLists([]));
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, user]);

  const add = async (playlistId: string) => {
    setBusy(true);
    const res = await fetch(`/api/playlists/${playlistId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId }),
    });
    if (res.ok) setSaved((s) => new Set(s).add(playlistId));
    setBusy(false);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), visibility: "PRIVATE" }),
    });
    const data = (await res.json()) as { playlist?: { id: string } };
    setBusy(false);
    if (data.playlist) {
      setTitle("");
      setLists((l) => [{ id: data.playlist!.id, title: title.trim(), visibility: "PRIVATE", itemsCount: 0 }, ...(l ?? [])]);
      await add(data.playlist.id);
    }
  };

  const button = buttonVariants({ size: "sm", shape: "rounded" });

  if (!user) {
    return (
      <Link href="/auth/login" className={button}>
        <ListPlus className="h-4 w-4" /> {t("collections.save")}
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <Button size="sm" shape="rounded" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ListPlus className="h-4 w-4" aria-hidden /> {t("collections.save")}
      </Button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-border-default bg-surface-1/95 p-3 shadow-2xl backdrop-blur-xl">
          <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-fg-muted">{t("collections.saveTo")}</p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {lists === null && <p className="px-1 py-2 text-xs text-fg-muted">{t("collections.loading")}</p>}
            {lists?.length === 0 && <p className="px-1 py-2 text-xs text-fg-muted">{t("collections.none")}</p>}
            {lists?.map((p) => (
              <button
                key={p.id}
                disabled={busy || saved.has(p.id)}
                onClick={() => add(p.id)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs text-fg hover:bg-surface-2 disabled:opacity-70"
              >
                <span className="flex items-center gap-2 truncate">
                  {React.createElement(audienceOf(p.visibility).icon, { className: "h-3 w-3 shrink-0 text-fg-muted", "aria-label": audienceOf(p.visibility).label })}
                  {p.title}
                </span>
                {saved.has(p.id) ? <Check className="h-4 w-4 text-success" /> : <span className="font-mono text-[10px] text-fg-muted">{p.itemsCount}</span>}
              </button>
            ))}
          </div>
          <form onSubmit={create} className="mt-2 flex gap-2 border-t border-border-subtle pt-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={t("collections.newPlaceholder")}
              aria-label={t("collections.newPlaceholder")}
              className="h-9 min-w-0 flex-1 rounded-xl px-3 text-xs"
            />
            <IconButton type="submit" variant="primary" shape="rounded" disabled={busy || !title.trim()} className="h-9 w-9 rounded-xl" label={t("collections.create")}>
              <Plus className="h-4 w-4" aria-hidden />
            </IconButton>
          </form>
        </div>
      )}
    </div>
  );
}
