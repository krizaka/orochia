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
    <div className="space-y-3 rounded-2xl border border-border-subtle bg-black/20 p-3 light:bg-slate-50/70">
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
          className="min-w-0 flex-1 rounded-xl border border-border-default bg-surface-2/80 px-3 py-2 text-xs text-fg placeholder:text-fg-muted focus:border-accent focus:outline-hidden"
        />
        <button disabled={busy || !username.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-white transition-colors hover:bg-accent-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40">
          <UserPlus className="h-3.5 w-3.5" /> {t("audience.invite")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value=""
          disabled={busy || available.length === 0}
          onChange={(e) => e.target.value && void call(endpoint, "POST", { listId: e.target.value })}
          aria-label={t("audience.listLabel")}
          className="rounded-xl border border-border-default bg-surface-2 px-3 py-2 text-xs text-fg focus:border-accent focus:outline-hidden disabled:opacity-50"
        >
          <option value="">{myLists.length === 0 ? t("audience.noList") : available.length === 0 ? t("audience.allAdded") : t("audience.addList")}</option>
          {available.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.membersCount})
            </option>
          ))}
        </select>
        <Link href="/dashboard?tab=lists" className="text-[11px] font-semibold text-accent underline-offset-2 hover:underline">
          {t("audience.manage")}
        </Link>
      </div>

      {error && <p className="text-[11px] text-danger">{error}</p>}
      {people === null ? (
        <p className="text-[11px] text-fg-muted">{t("audience.loading")}</p>
      ) : empty ? (
        <p className="text-[11px] text-fg-muted">{t("audience.nobody")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {attached.map((l) => (
            <li key={l.id} className="inline-flex items-center gap-1 rounded-full bg-accent/15 py-1 pl-3 pr-1 text-[11px] text-accent">
              <ListChecks className="h-3 w-3" aria-hidden /> {l.name} · {l.membersCount}
              <button disabled={busy} onClick={() => call(`${endpoint}?listId=${l.id}`, "DELETE")} className="rounded-full p-0.5 hover:text-danger" aria-label={t("audience.removeList", { name: l.name })}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
          {people?.map((p) => (
            <li key={p.userId} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-[11px] text-fg">
              @{p.username}
              <button disabled={busy} onClick={() => call(`${endpoint}?userId=${p.userId}`, "DELETE")} className="rounded-full p-0.5 text-fg-secondary hover:text-danger" aria-label={t("audience.withdraw", { username: p.username })}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
