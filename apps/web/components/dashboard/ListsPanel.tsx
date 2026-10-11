"use client";

import { ChevronDown, Plus, Trash2, UserPlus, X } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

import { Button, cn, ConfirmButton, EmptyState, IconButton, Input, undoToast } from "@/components/ui";
import { t } from "@/lib/i18n";

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

const field = "h-auto rounded-2xl bg-surface-2/80 px-4 py-3";

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
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={51}
          placeholder={t("lists.usernamePlaceholder")}
          aria-label={t("lists.addTo", { name: list.name })}
          className={cn(field, "min-w-0 flex-1 py-2 text-xs")}
        />
        <Button type="submit" variant="primary" size="sm" shape="rounded" disabled={busy || !username.trim()} className="h-auto rounded-xl font-bold">
          <UserPlus className="h-3.5 w-3.5" aria-hidden /> {t("common.add")}
        </Button>
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
              <IconButton disabled={busy} onClick={() => remove(m.userId)} className="h-5 w-5 hover:bg-transparent hover:text-danger" label={t("lists.removeMember", { username: m.username })}>
                <X className="h-3 w-3" aria-hidden />
              </IconButton>
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

  // Deleted after the undo window: the list leaves at once, the DELETE goes when the toast does.
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const remove = (list: List) => {
    setLeaving((s) => new Set(s).add(list.id));
    undoToast(t("lists.deleted", { name: list.name }), {
      onUndo: () => setLeaving((s) => { const next = new Set(s); next.delete(list.id); return next; }),
      onCommit: () => void fetch(`/api/me/lists/${list.id}`, { method: "DELETE" }).finally(load),
    });
  };
  const shown = lists?.filter((l) => !leaving.has(l.id)) ?? null;

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="flex flex-col gap-3 sm:flex-row">
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t("lists.namePlaceholder")} className={cn(field, "flex-1")} />
        <Button type="submit" variant="sensual" shape="rounded" disabled={!name.trim()} className="h-auto rounded-2xl px-5 py-3 text-xs font-bold">
          <Plus className="h-4 w-4" aria-hidden /> {t("common.create")}
        </Button>
      </form>
      <p className="-mt-3 text-[11px] text-fg-muted">
        {t("lists.intro")}
      </p>
      {error && <p className="text-xs text-danger">{error}</p>}

      {shown === null ? (
        <p className="text-xs text-fg-muted">{t("lists.loading")}</p>
      ) : shown.length === 0 ? (
        <EmptyState bird="falcon" title={t("lists.none")} className="rounded-3xl bg-surface-2/40" />
      ) : (
        <ul className="glass-panel divide-y divide-border-subtle rounded-3xl px-5">
          {shown.map((l) => (
            <li key={l.id} className="py-3.5">
              <div className="flex items-center justify-between gap-3">
                <button onClick={() => setOpen(open === l.id ? null : l.id)} className="flex min-w-0 items-center gap-2 text-left" aria-expanded={open === l.id}>
                  <ChevronDown className={cn(
                    "h-4 w-4 shrink-0 text-fg-muted transition-transform",
                    open === l.id ? "rotate-180" : ""
                  )} />
                  <span className="truncate text-sm font-semibold text-fg">{l.name}</span>
                  <span className="font-mono text-[11px] text-fg-muted">{t("lists.people", { count: l.membersCount })}</span>
                </button>
                <ConfirmButton size="sm" label={t("lists.delete", { name: l.name })} confirmLabel={t("lists.confirmDelete")} onConfirm={() => remove(l)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </ConfirmButton>
              </div>
              {open === l.id && <Members list={l} onChange={load} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
