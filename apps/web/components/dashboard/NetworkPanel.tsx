"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Check, UserMinus, X } from "lucide-react";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

interface Person {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  since: string;
}
interface Network {
  followers: Person[];
  following: Person[];
  contacts: Person[];
  incoming: Person[];
  outgoing: Person[];
}

function Row({ p, children }: { p: Person; children?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <Link href={`/@${p.username}`} className="flex min-w-0 items-center gap-3">
        <img src={p.avatarUrl || AVATAR_PLACEHOLDER} alt="" className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover light:border-black/10" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white light:text-slate-900">{p.displayName}</span>
          <span className="block text-[11px] font-mono text-zinc-500 light:text-slate-500">@{p.username}</span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </li>
  );
}

function Section({ title, empty, people, render }: { title: string; empty: string; people: Person[]; render: (p: Person) => React.ReactNode }) {
  return (
    <div className="glass-panel rounded-3xl p-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 light:text-slate-500">
        {title} <span className="ml-1 font-mono text-zinc-500 light:text-slate-500">{people.length}</span>
      </h3>
      {people.length === 0 ? <p className="mt-3 text-xs text-zinc-500 light:text-slate-500">{empty}</p> : <ul className="mt-2 divide-y divide-white/5 light:divide-black/5">{people.map(render)}</ul>}
    </div>
  );
}

const iconBtn = "rounded-lg p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white light:text-slate-500 light:hover:text-slate-950";

/** Followers to approve (creators), contact requests to answer, and everyone you follow or know. */
export function NetworkPanel({ isCreator }: { isCreator: boolean }) {
  const [data, setData] = useState<Network | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/network", { cache: "no-store" });
    if (res.ok) setData(((await res.json()) as { data: Network }).data);
  }, []);
  useEffect(() => void load(), [load]);

  const act = async (url: string, method: string, body?: object) => {
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    await load();
  };

  if (!data) return <p className="text-xs text-zinc-500 light:text-slate-500">{t("network.loading")}</p>;
  const pendingFollowers = data.followers.filter((p) => p.status === "PENDING");
  const approvedFollowers = data.followers.filter((p) => p.status === "APPROVED");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {isCreator && (
        <Section
          title={t("network.followRequests")}
          empty={t("network.followRequestsEmpty")}
          people={pendingFollowers}
          render={(p) => (
            <Row key={p.id} p={p}>
              <button className={iconBtn} aria-label={t("network.approve")} onClick={() => act(`/api/me/followers/${p.id}`, "PATCH", { action: "approve" })}><Check className="h-4 w-4 text-emerald-400" /></button>
              <button className={iconBtn} aria-label={t("network.decline")} onClick={() => act(`/api/me/followers/${p.id}`, "PATCH", { action: "remove" })}><X className="h-4 w-4" /></button>
            </Row>
          )}
        />
      )}
      <Section
        title={t("network.contactRequests")}
        empty={t("network.contactRequestsEmpty")}
        people={data.incoming}
        render={(p) => (
          <Row key={p.id} p={p}>
            <button className={iconBtn} aria-label={t("network.accept")} onClick={() => act(`/api/contacts/${p.id}`, "PATCH", { action: "accept" })}><Check className="h-4 w-4 text-emerald-400" /></button>
            <button className={iconBtn} aria-label={t("network.reject")} onClick={() => act(`/api/contacts/${p.id}`, "PATCH", { action: "reject" })}><X className="h-4 w-4" /></button>
            <button className={iconBtn} aria-label={t("network.block")} onClick={() => act(`/api/contacts/${p.id}`, "PATCH", { action: "block" })}><Ban className="h-4 w-4 text-rose-400" /></button>
          </Row>
        )}
      />
      {isCreator && (
        <Section
          title={t("network.followers")}
          empty={t("network.followersEmpty")}
          people={approvedFollowers}
          render={(p) => (
            <Row key={p.id} p={p}>
              <button className={iconBtn} aria-label={t("network.removeFollower")} onClick={() => act(`/api/me/followers/${p.id}`, "PATCH", { action: "remove" })}><UserMinus className="h-4 w-4" /></button>
            </Row>
          )}
        />
      )}
      <Section
        title={t("network.contacts")}
        empty={t("network.contactsEmpty")}
        people={data.contacts}
        render={(p) => (
          <Row key={p.id} p={p}>
            <button className={iconBtn} aria-label={t("network.removeContact")} onClick={() => act(`/api/contacts/${p.id}`, "DELETE")}><UserMinus className="h-4 w-4" /></button>
          </Row>
        )}
      />
      <Section
        title={t("network.following")}
        empty={t("network.followingEmpty")}
        people={data.following}
        render={(p) => (
          <Row key={p.id} p={p}>
            <span className={`text-[10px] font-bold uppercase ${p.status === "APPROVED" ? "text-emerald-400" : "text-amber-400"}`}>{p.status === "APPROVED" ? t("network.approved") : t("network.pending")}</span>
            <button className={iconBtn} aria-label={t("network.unfollow")} onClick={() => act(`/api/creators/${p.username}/follow`, "DELETE")}><UserMinus className="h-4 w-4" /></button>
          </Row>
        )}
      />
      <Section
        title={t("network.outgoing")}
        empty={t("network.outgoingEmpty")}
        people={data.outgoing}
        render={(p) => (
          <Row key={p.id} p={p}>
            <button className={iconBtn} aria-label={t("network.withdraw")} onClick={() => act(`/api/contacts/${p.id}`, "DELETE")}><X className="h-4 w-4" /></button>
          </Row>
        )}
      />
    </div>
  );
}
