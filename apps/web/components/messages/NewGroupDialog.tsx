"use client";

import React, { useState } from "react";

import { Button, Checkbox, Dialog, Input, Sheet } from "@/components/ui";
import { responseErrorMessage } from "@/lib/api-errors";
import { MAX_GROUP_MEMBERS } from "@/lib/group-rules";
import { useI18n } from "@/lib/i18n-client";

interface Contact {
  userId: string;
  username: string;
  displayName: string;
}

/** A new group: a name and some of your contacts (a group takes only contacts — or, for a creator, approved fans). */
export function NewGroupDialog({ onCreated, children }: { onCreated: (conversationId: string) => void; children: React.ReactNode }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, memberIds: [...picked] }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(res ? await responseErrorMessage(t, res, t("inbox.group.createFailed")) : t("inbox.network"));
    const { conversationId } = (await res.json()) as { conversationId: string };
    setOpen(false);
    setTitle("");
    setPicked(new Set());
    onCreated(conversationId);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !contacts) {
          void fetch("/api/me/network", { cache: "no-store" })
            .then(async (res) => (res.ok ? setContacts(((await res.json()) as { data: { contacts: Contact[] } }).data.contacts) : setContacts([])))
            .catch(() => setContacts([]));
        }
      }}
    >
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Sheet size="md" aria-describedby={undefined}>
        <form onSubmit={submit}>
          <Dialog.Header>
            <Dialog.Title>{t("inbox.group.new")}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <div className="space-y-4">
              <Input aria-label={t("inbox.group.name")} placeholder={t("inbox.group.namePlaceholder")} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
              <p className="text-[11px] text-fg-secondary">{t("inbox.group.newHint", { max: MAX_GROUP_MEMBERS })}</p>
              {contacts && contacts.length === 0 ? (
                <p className="text-xs text-fg-secondary">{t("inbox.group.noContacts")}</p>
              ) : (
                <ul className="max-h-64 divide-y divide-border-subtle overflow-y-auto" aria-label={t("inbox.group.pick")}>
                  {(contacts ?? []).map((c) => (
                    <li key={c.userId} className="flex items-center gap-3 py-2">
                      <Checkbox
                        checked={picked.has(c.userId)}
                        aria-label={c.displayName}
                        onCheckedChange={(on) =>
                          setPicked((s) => {
                            const next = new Set(s);
                            if (on) next.add(c.userId);
                            else next.delete(c.userId);
                            return next;
                          })
                        }
                      />
                      <span className="truncate text-sm text-fg">{c.displayName}</span>
                      <span className="truncate text-[11px] text-fg-secondary">@{c.username}</span>
                    </li>
                  ))}
                </ul>
              )}
              {error && (
                <p role="alert" className="text-xs text-fg-danger">
                  {error}
                </p>
              )}
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="submit" variant="primary" loading={busy} disabled={!title.trim() || picked.size === 0}>
              {t("inbox.group.create")}
            </Button>
          </Dialog.Footer>
        </form>
      </Sheet>
    </Dialog.Root>
  );
}
