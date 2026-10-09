"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, UserPlus, Users, UserCheck, MessageSquare } from "lucide-react";
import { t } from "@/lib/i18n";
import { Button, buttonVariants, cn, orochiaButton } from "@/components/ui";
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

  // Orochia's gradient (sensual) for the call to action, secondary for the rest; sm in a row of actions.
  const look = { size: size === "sm" ? "sm" : "lg", shape: "rounded", className: size === "sm" ? "rounded-xl" : "rounded-2xl text-xs font-bold" } as const;
  const primary = orochiaButton({ ...look, variant: "sensual" });
  const ghost = buttonVariants({ ...look, variant: "secondary" });

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
          <Button {...look} variant="sensual" disabled={busy} onClick={() => call(`/api/creators/${username}/follow`, { method: "POST" })}>
            <UserPlus className="h-4 w-4" /> {t("relationship.follow")}
          </Button>
        ) : (
          <Button
            {...look}
            variant="secondary"
            disabled={busy}
            title={t("relationship.unfollow")}
            onClick={() => call(`/api/creators/${username}/follow`, { method: "DELETE" })}
          >
            {follow === "APPROVED" ? <UserCheck className="h-4 w-4 text-success" /> : <Clock className="h-4 w-4 text-warning" />}
            {follow === "APPROVED" ? t("relationship.following") : t("relationship.requested")}
          </Button>
        ))}

      {show.includes("contact") &&
        (contact === null || contact.status === "REJECTED" ? (
          <Button {...look} variant="secondary" disabled={busy} onClick={() => call("/api/contacts", { method: "POST", body: JSON.stringify({ username }) })}>
            <Users className="h-4 w-4" /> {t("relationship.addContact")}
          </Button>
        ) : contact.status === "ACCEPTED" ? (
          <span className={cn(ghost, "cursor-default hover:bg-surface-2")}>
            <Check className="h-4 w-4 text-success" /> {t("relationship.contact")}
          </span>
        ) : contact.status === "PENDING" && contact.direction === "incoming" ? (
          <Button
            {...look}
            variant="sensual"
            disabled={busy}
            onClick={() => call(`/api/contacts/${contact.id}`, { method: "PATCH", body: JSON.stringify({ action: "accept" }) })}
          >
            <Check className="h-4 w-4" /> {t("relationship.accept")}
          </Button>
        ) : contact.status === "PENDING" ? (
          <Button
            {...look}
            variant="secondary"
            disabled={busy}
            title={t("relationship.withdraw")}
            onClick={() => call(`/api/contacts/${contact.id}`, { method: "DELETE" })}
          >
            <Clock className="h-4 w-4 text-warning" /> {t("relationship.requestSent")}
          </Button>
        ) : null)}

      {user && user.username !== username && (
        <Link
          href={`/messages?user=${username}`}
          className={ghost}
          title={t("relationship.message")}
        >
          <MessageSquare className="h-4 w-4 text-accent" /> {t("relationship.message")}
        </Link>
      )}

      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  );
}
