"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChevronDown, Plus, Trash2, UserPlus, X } from "lucide-react";
import { t } from "@/lib/i18n";
import { ConfirmIconButton } from "@/components/ui";

interface List {
  id: string;
  name: string;
  membersCount: number;
}

interface Member {
  userId: string;
  username: string;
  displayName: string;
}

const field =
  "rounded-2xl border border-border-default bg-surface-2/80 px-4 py-3 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-hidden";

function Members({ list, onChange }: { list: List; onChange: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/me/lists/${list.id}/members`, { cache: "no-store" });
    if (res.ok) setMembers(((await res.json()) as { members: Member[] }).members);
  }, [list.id]);
  useEffect(() => void load(), [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/me/lists/${list.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim().replace(/^@/, "") }),
    });
    setBusy(false);
    if (!res.ok) return setError(res.status === 404 ? t("lists.noAccount") : t("lists.addFailed"));
    setUsername("");
    await load();
    onChange();
  };

  const remove = async (userId: string) => {
    setBusy(true);
    await fetch(`/api/me/lists/${list.id}/members?userId=${userId}`, { method: "DELETE" });
    setBusy(false);
    await load();
    onChange();
  };

  return (
    <div className="mt-3 space-y-2 rounded-2xl border border-border-subtle bg-black/20 p-3">
      <form onSubmit={add} className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={51}
          placeholder={t("lists.usernamePlaceholder")}
          aria-label={t("lists.addTo", { name: list.name })}
          className={`${field} min-w-0 flex-1 py-2 text-xs`}
        />
        <button disabled={busy || !username.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 text-xs font-bold text-white disabled:opacity-40">
          <UserPlus className="h-3.5 w-3.5" /> {t("common.add")}
        </button>
      </form>
      {error && <p className="text-[11px] text-danger">{error}</p>}
      {members === null ? (
        <p className="text-[11px] text-fg-muted">{t("lists.loading")}</p>
      ) : members.length === 0 ? (
        <p className="text-[11px] text-fg-muted">{t("lists.empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <li key={m.userId} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-[11px] text-fg">
              @{m.username}
              <button disabled={busy} onClick={() => remove(m.userId)} className="rounded-full p-0.5 text-fg-secondary hover:text-danger" aria-label={t("lists.removeMember", { username: m.username })}>
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Your reusable audience lists ("Close friends", "Patrons 2026"…): private to you, attached to
 * invited-only videos and collections. Changing a list changes who opens everything it is attached to.
 */
export function ListsPanel() {
  const [lists, setLists] = useState<List[] | null>(null);
  const [name, setName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/lists", { cache: "no-store" });
    if (res.ok) setLists(((await res.json()) as { lists: List[] }).lists);
  }, []);
  useEffect(() => void load(), [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    const res = await fetch("/api/me/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    if (!res.ok) return setError(res.status === 409 ? t("lists.duplicate") : t("lists.createFailed"));
    const { list } = (await res.json()) as { list: { id: string } };
    setName("");
    setOpen(list.id);
    await load();
  };

  const remove = async (list: List) => {
    await fetch(`/api/me/lists/${list.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t("lists.namePlaceholder")} className={`${field} flex-1`} />
        <button disabled={!name.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-accent to-accent-2 px-5 py-3 text-xs font-bold text-white disabled:opacity-40">
          <Plus className="h-4 w-4" /> {t("common.create")}
        </button>
      </form>
      <p className="-mt-3 text-[11px] text-fg-muted">
        {t("lists.intro")}
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}

      {lists === null ? (
        <p className="text-xs text-fg-muted">{t("lists.loading")}</p>
      ) : lists.length === 0 ? (
        <div className="rounded-3xl border border-border-default bg-surface-2/40 p-12 text-center text-sm text-fg-secondary">{t("lists.none")}</div>
      ) : (
        <ul className="glass-panel divide-y divide-border-subtle rounded-3xl px-5">
          {lists.map((l) => (
            <li key={l.id} className="py-3.5">
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => setOpen(open === l.id ? null : l.id)} className="flex min-w-0 items-center gap-2 text-left" aria-expanded={open === l.id}>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-fg-muted transition-transform ${open === l.id ? "rotate-180" : ""}`} />
                  <span className="truncate text-sm font-semibold text-fg">{l.name}</span>
                  <span className="font-mono text-[11px] text-fg-muted">{t("lists.people", { count: l.membersCount })}</span>
                </button>
                <ConfirmIconButton label={t("lists.delete", { name: l.name })} confirmLabel={t("lists.confirmDelete")} onConfirm={() => void remove(l)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </ConfirmIconButton>
              </div>
              {open === l.id && <Members list={l} onChange={load} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
