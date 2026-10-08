"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListChecks, UserPlus, X } from "lucide-react";
import { t } from "@/lib/i18n";

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

  const call = async (url: string, method: string, body?: object, failure = t("audience.failed")) => {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!res.ok) {
      setError(res.status === 404 && body && "username" in body ? t("audience.noAccount") : failure);
      return false;
    }
    await load();
    onChange?.();
    return true;
  };

  const available = myLists.filter((l) => !attached.some((a) => a.id === l.id));
  const empty = people !== null && people.length === 0 && attached.length === 0;

  return (
    <div className="space-y-3 rounded-2xl border border-white/5 bg-black/20 p-3 light:border-black/10 light:bg-slate-50/70">
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
          placeholder={t("audience.usernamePlaceholder")}
          aria-label={t("audience.usernameLabel")}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:placeholder:text-slate-400 light:text-slate-900"
        />
        <button disabled={busy || !username.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-40">
          <UserPlus className="h-3.5 w-3.5" /> {t("audience.invite")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value=""
          disabled={busy || available.length === 0}
          onChange={(e) => e.target.value && void call(endpoint, "POST", { listId: e.target.value })}
          aria-label={t("audience.listLabel")}
          className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none disabled:opacity-50 light:bg-slate-50 light:border-black/10 light:text-slate-700"
        >
          <option value="">{myLists.length === 0 ? t("audience.noList") : available.length === 0 ? t("audience.allAdded") : t("audience.addList")}</option>
          {available.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.membersCount})
            </option>
          ))}
        </select>
        <Link href="/dashboard?tab=lists" className="text-[11px] font-semibold text-violet-300 underline-offset-2 hover:underline light:text-violet-700">
          {t("audience.manage")}
        </Link>
      </div>

      {error && <p className="text-[11px] text-rose-300">{error}</p>}
      {people === null ? (
        <p className="text-[11px] text-zinc-500 light:text-slate-500">{t("audience.loading")}</p>
      ) : empty ? (
        <p className="text-[11px] text-zinc-500 light:text-slate-500">{t("audience.nobody")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {attached.map((l) => (
            <li key={l.id} className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 py-1 pl-3 pr-1 text-[11px] text-violet-200 light:bg-violet-100 light:text-violet-800">
              <ListChecks className="h-3 w-3" aria-hidden /> {l.name} · {l.membersCount}
              <button disabled={busy} onClick={() => call(`${endpoint}?listId=${l.id}`, "DELETE")} className="rounded-full p-0.5 hover:text-rose-300" aria-label={t("audience.removeList", { name: l.name })}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
          {people?.map((p) => (
            <li key={p.userId} className="inline-flex items-center gap-1 rounded-full bg-white/5 py-1 pl-3 pr-1 text-[11px] text-zinc-200 light:bg-black/5 light:text-slate-700">
              @{p.username}
              <button disabled={busy} onClick={() => call(`${endpoint}?userId=${p.userId}`, "DELETE")} className="rounded-full p-0.5 text-zinc-400 hover:text-rose-300 light:text-slate-500" aria-label={t("audience.withdraw", { username: p.username })}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
