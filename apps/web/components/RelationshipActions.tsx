"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, UserPlus, Users, UserCheck, MessageSquare } from "lucide-react";
import { t } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";

type Follow = "PENDING" | "APPROVED" | null;
interface Contact {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "BLOCKED";
  direction: "outgoing" | "incoming";
}

/**
 * Follow and contact actions toward a creator, with the real state from the API:
 * a follow is PENDING until the creator approves it; a contact request is answered by its addressee.
 */
export function RelationshipActions({
  username,
  show = ["follow", "contact"],
  onChange,
  size = "md",
}: {
  username: string;
  show?: ("follow" | "contact")[];
  onChange?: () => void;
  size?: "sm" | "md";
}) {
  const { user } = useAuth();
  const [follow, setFollow] = useState<Follow>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/creators/${username}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { relationship: { follow: Follow; contact: Contact | null } | null };
    setFollow(data.relationship?.follow ?? null);
    setContact(data.relationship?.contact ?? null);
  }, [username]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const call = async (input: RequestInfo, init: RequestInit) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(input, { ...init, headers: { "Content-Type": "application/json" } });
      if (!res.ok) setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t("relationship.failed"));
      await load();
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  const base =
    size === "sm"
      ? "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50"
      : "inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-bold transition-all disabled:opacity-50";
  const primary = `${base} bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30 hover:scale-105`;
  const ghost = `${base} border border-white/10 bg-zinc-900/90 text-zinc-300 hover:text-white hover:bg-white/10 light:bg-slate-50 light:border-black/10 light:text-slate-700 light:hover:bg-slate-200 light:hover:text-slate-950`;

  if (!user) {
    return (
      <Link href="/auth/login" className={primary}>
        <UserPlus className="h-4 w-4" /> {t("relationship.signInToFollow")}
      </Link>
    );
  }
  if (user.username === username) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {show.includes("follow") &&
        (follow === null ? (
          <button className={primary} disabled={busy} onClick={() => call(`/api/creators/${username}/follow`, { method: "POST" })}>
            <UserPlus className="h-4 w-4" /> {t("relationship.follow")}
          </button>
        ) : (
          <button
            className={ghost}
            disabled={busy}
            title={t("relationship.unfollow")}
            onClick={() => call(`/api/creators/${username}/follow`, { method: "DELETE" })}
          >
            {follow === "APPROVED" ? <UserCheck className="h-4 w-4 text-emerald-400" /> : <Clock className="h-4 w-4 text-amber-400" />}
            {follow === "APPROVED" ? t("relationship.following") : t("relationship.requested")}
          </button>
        ))}

      {show.includes("contact") &&
        (contact === null || contact.status === "REJECTED" ? (
          <button className={ghost} disabled={busy} onClick={() => call("/api/contacts", { method: "POST", body: JSON.stringify({ username }) })}>
            <Users className="h-4 w-4" /> {t("relationship.addContact")}
          </button>
        ) : contact.status === "ACCEPTED" ? (
          <span className={`${ghost} cursor-default`}>
            <Check className="h-4 w-4 text-emerald-400" /> {t("relationship.contact")}
          </span>
        ) : contact.status === "PENDING" && contact.direction === "incoming" ? (
          <button
            className={primary}
            disabled={busy}
            onClick={() => call(`/api/contacts/${contact.id}`, { method: "PATCH", body: JSON.stringify({ action: "accept" }) })}
          >
            <Check className="h-4 w-4" /> {t("relationship.accept")}
          </button>
        ) : contact.status === "PENDING" ? (
          <button
            className={ghost}
            disabled={busy}
            title={t("relationship.withdraw")}
            onClick={() => call(`/api/contacts/${contact.id}`, { method: "DELETE" })}
          >
            <Clock className="h-4 w-4 text-amber-400" /> {t("relationship.requestSent")}
          </button>
        ) : null)}

      {user && user.username !== username && (
        <Link
          href={`/messages?user=${username}`}
          className={ghost}
          title={t("relationship.message")}
        >
          <MessageSquare className="h-4 w-4 text-violet-400" /> {t("relationship.message")}
        </Link>
      )}

      {error && <span className="text-[11px] text-rose-400">{error}</span>}
    </div>
  );
}
