"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListChecks, UserPlus, X } from "lucide-react";

interface Person {
  userId: string;
  username: string;
}

interface ListCard {
  id: string;
  name: string;
  membersCount: number;
}

/**
 * Who an invited-only video or collection is open to: accounts invited by username and the owner's
 * reusable lists. `endpoint` is the target's audience API (`/api/videos/<id>/audience`,
 * `/api/playlists/<id>/members`).
 */
export function AudienceEditor({ endpoint, onChange }: { endpoint: string; onChange?: () => void }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [attached, setAttached] = useState<ListCard[]>([]);
  const [myLists, setMyLists] = useState<ListCard[]>([]);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [audience, lists] = await Promise.all([fetch(endpoint, { cache: "no-store" }), fetch("/api/me/lists", { cache: "no-store" })]);
    if (audience.ok) {
      const data = (await audience.json()) as { members: Person[]; lists: ListCard[] };
      setPeople(data.members);
      setAttached(data.lists);
    } else setPeople([]);
    if (lists.ok) setMyLists(((await lists.json()) as { lists: ListCard[] }).lists);
  }, [endpoint]);
  useEffect(() => void load(), [load]);

  const call = async (url: string, method: string, body?: object, failure = "The change could not be saved.") => {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!res.ok) {
      setError(res.status === 404 && body && "username" in body ? "No account with that username." : failure);
      return false;
    }
    await load();
    onChange?.();
    return true;
  };

  const available = myLists.filter((l) => !attached.some((a) => a.id === l.id));
  const empty = people !== null && people.length === 0 && attached.length === 0;

  return (
    <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-3">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (username.trim() && (await call(endpoint, "POST", { username: username.trim().replace(/^@/, "") }))) setUsername("");
        }}
        className="flex gap-2"
      >
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={51}
          placeholder="@username"
          aria-label="Username to invite"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none"
        />
        <button disabled={busy || !username.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white disabled:opacity-40">
          <UserPlus className="h-3.5 w-3.5" /> Invite
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value=""
          disabled={busy || available.length === 0}
          onChange={(e) => e.target.value && void call(endpoint, "POST", { listId: e.target.value })}
          aria-label="Open to one of your lists"
          className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none disabled:opacity-50"
        >
          <option value="">{myLists.length === 0 ? "No list yet" : available.length === 0 ? "All your lists are added" : "Add one of your lists…"}</option>
          {available.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.membersCount})
            </option>
          ))}
        </select>
        <Link href="/dashboard?tab=lists" className="text-[11px] text-violet-300 hover:underline">
          Manage lists
        </Link>
      </div>

      {error && <p className="text-[11px] text-rose-300">{error}</p>}
      {people === null ? (
        <p className="text-[11px] text-zinc-500">Loading…</p>
      ) : empty ? (
        <p className="text-[11px] text-zinc-500">Nobody yet: only you can open it.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {attached.map((l) => (
            <li key={l.id} className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 py-1 pl-3 pr-1 text-[11px] text-violet-200">
              <ListChecks className="h-3 w-3" aria-hidden /> {l.name} · {l.membersCount}
              <button disabled={busy} onClick={() => call(`${endpoint}?listId=${l.id}`, "DELETE")} className="rounded-full p-0.5 hover:text-rose-300" aria-label={`Remove list ${l.name}`}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
          {people?.map((p) => (
            <li key={p.userId} className="inline-flex items-center gap-1 rounded-full bg-white/5 py-1 pl-3 pr-1 text-[11px] text-zinc-200">
              @{p.username}
              <button disabled={busy} onClick={() => call(`${endpoint}?userId=${p.userId}`, "DELETE")} className="rounded-full p-0.5 text-zinc-400 hover:text-rose-300" aria-label={`Withdraw @${p.username}`}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
