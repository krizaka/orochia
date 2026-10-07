"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ListPlus, Lock, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface PlaylistCard {
  id: string;
  title: string;
  isPrivate: boolean;
  itemsCount: number;
}

/** "Save to playlist": pick one of your playlists or create one, then the video is appended. */
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
      body: JSON.stringify({ title: title.trim(), isPrivate: true }),
    });
    const data = (await res.json()) as { playlist?: { id: string } };
    setBusy(false);
    if (data.playlist) {
      setTitle("");
      setLists((l) => [{ id: data.playlist!.id, title: title.trim(), isPrivate: true, itemsCount: 0 }, ...(l ?? [])]);
      await add(data.playlist.id);
    }
  };

  const button =
    "flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors";

  if (!user) {
    return (
      <Link href="/auth/login" className={button}>
        <ListPlus className="h-4 w-4" /> Save
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button className={button} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <ListPlus className="h-4 w-4" /> Save
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-white/10 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-xl">
          <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Save to playlist</p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {lists === null && <p className="px-1 py-2 text-xs text-zinc-500">Loading…</p>}
            {lists?.length === 0 && <p className="px-1 py-2 text-xs text-zinc-500">No playlist yet — create one below.</p>}
            {lists?.map((p) => (
              <button
                key={p.id}
                disabled={busy || saved.has(p.id)}
                onClick={() => add(p.id)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-70"
              >
                <span className="flex items-center gap-2 truncate">
                  {p.isPrivate && <Lock className="h-3 w-3 text-zinc-500" />} {p.title}
                </span>
                {saved.has(p.id) ? <Check className="h-4 w-4 text-emerald-400" /> : <span className="font-mono text-[10px] text-zinc-500">{p.itemsCount}</span>}
              </button>
            ))}
          </div>
          <form onSubmit={create} className="mt-2 flex gap-2 border-t border-white/5 pt-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="New playlist"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
            />
            <button disabled={busy || !title.trim()} className="rounded-xl bg-violet-600 px-3 text-white disabled:opacity-40" aria-label="Create playlist">
              <Plus className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
