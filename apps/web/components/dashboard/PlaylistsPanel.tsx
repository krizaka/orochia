"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Globe, Lock, Plus, Trash2 } from "lucide-react";

interface Playlist {
  id: string;
  title: string;
  description: string | null;
  isPrivate: boolean;
  itemsCount: number;
}

/** Your playlists: create, make public / private, delete. Videos are added from any watch page. */
export function PlaylistsPanel() {
  const [lists, setLists] = useState<Playlist[] | null>(null);
  const [title, setTitle] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/playlists", { cache: "no-store" });
    if (res.ok) setLists(((await res.json()) as { playlists: Playlist[] }).playlists);
  }, []);
  useEffect(() => void load(), [load]);

  const send = async (url: string, method: string, body?: object) => {
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    await load();
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void send("/api/playlists", "POST", { title: title.trim(), isPrivate: true }).then(() => setTitle(""));
        }}
        className="flex gap-3"
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="New playlist title"
          className="flex-1 rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
        />
        <button disabled={!title.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 text-xs font-bold text-white disabled:opacity-40">
          <Plus className="h-4 w-4" /> Create
        </button>
      </form>

      {lists === null ? (
        <p className="text-xs text-zinc-500">Loading…</p>
      ) : lists.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-12 text-center text-sm text-zinc-400">
          No playlist yet. Create one, then use “Save” on any video.
        </div>
      ) : (
        <ul className="glass-panel divide-y divide-white/5 rounded-3xl px-5">
          {lists.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-3.5">
              <Link href={`/playlists/${p.id}`} className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white hover:text-violet-300">{p.title}</span>
                <span className="text-[11px] font-mono text-zinc-500">{p.itemsCount} videos</span>
              </Link>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => send(`/api/playlists/${p.id}`, "PATCH", { isPrivate: !p.isPrivate })}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/5"
                  title={p.isPrivate ? "Make public: shown on your profile" : "Make private"}
                >
                  {p.isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5 text-emerald-400" />}
                  {p.isPrivate ? "Private" : "Public"}
                </button>
                <button
                  onClick={() => window.confirm(`Delete “${p.title}”?`) && void send(`/api/playlists/${p.id}`, "DELETE")}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-rose-500/10 hover:text-rose-300"
                  aria-label={`Delete ${p.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
