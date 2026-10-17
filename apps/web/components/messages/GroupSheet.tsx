"use client";

import { MoreIcon, PlusIcon } from "@krizaka/icons";
import React, { useState } from "react";

import { AlertDialog, Avatar, Badge, Button, Checkbox, cn, Dialog, IconButton, Input, Sheet, Spinner, Switch, toast } from "@/components/ui";
import { responseErrorMessage } from "@/lib/api-errors";
import { MemberRole } from "@/lib/conversation-kinds";
import { t } from "@/lib/i18n";
import { defaultAvatarFor } from "@/lib/presets";

interface Member {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "owner" | "member";
}
interface GroupInfo {
  title: string | null;
  archived: boolean;
  muted: boolean;
  role: "owner" | "member";
  members: Member[];
}
interface Contact {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

const json = { "Content-Type": "application/json" };
const MUTE_HOURS = 8;

/**
 * A group's sheet: who is in it, mute, leave; for the owner also rename, add contacts, an invite link, remove, close.
 * Loaded when it opens (an action, not an effect). Every change goes through /api/groups and the screen reloads its
 * list on the `conversation_changed` event.
 */
export function GroupSheet({ conversationId, myId, onLeft }: { conversationId: string; myId: string; onLeft: () => void }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<GroupInfo | null>(null);
  const [title, setTitle] = useState("");
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"leave" | "close" | null>(null);

  const load = async () => {
    const res = await fetch(`/api/groups/${conversationId}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return setError(res ? await responseErrorMessage(res, t("inbox.group.loadFailed")) : t("inbox.network"));
    const group = ((await res.json()) as { group: GroupInfo }).group;
    setInfo(group);
    setTitle(group.title ?? "");
  };

  const act = async (path: string, init: RequestInit, done?: () => void | Promise<void>) => {
    setBusy(true);
    setError(null);
    const res = await fetch(path, init).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(res ? await responseErrorMessage(res, t("inbox.group.actionFailed")) : t("inbox.network"));
      return false;
    }
    await done?.();
    await load();
    return true;
  };

  const loadContacts = async () => {
    const res = await fetch("/api/me/network", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setContacts(((await res.json()) as { data: { contacts: Contact[] } }).data.contacts);
  };

  const owner = info?.role === MemberRole.Owner;
  const inGroup = new Set(info?.members.map((m) => m.userId));
  const addable = (contacts ?? []).filter((c) => !inGroup.has(c.userId));

  return (
    <>
      <Dialog.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setError(null);
            setLink(null);
            void load();
            void loadContacts();
          }
        }}
      >
        <Dialog.Trigger asChild>
          <IconButton shape="rounded" className="h-9 w-9" label={t("inbox.group.info")}>
            <MoreIcon size={16} />
          </IconButton>
        </Dialog.Trigger>
        <Sheet size="md" aria-describedby={undefined}>
          <Dialog.Header>
            <Dialog.Title>{info?.title ?? t("inbox.group.info")}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            {!info ? (
              <div className="flex justify-center py-10 text-fg-muted">
                <Spinner size="md" className="text-current" />
              </div>
            ) : (
              <div className="space-y-6">
                {error && (
                  <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-fg-danger">
                    {error}
                  </p>
                )}
                {info.archived && <p className="rounded-xl border border-border-default bg-surface-2/60 p-3 text-xs text-fg-secondary">{t("inbox.group.closed")}</p>}

                {owner && !info.archived && (
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(`/api/groups/${conversationId}`, { method: "PATCH", headers: json, body: JSON.stringify({ title }) });
                    }}
                  >
                    <Input aria-label={t("inbox.group.name")} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
                    <Button type="submit" variant="secondary" loading={busy} disabled={!title.trim() || title.trim() === info.title}>
                      {t("common.save")}
                    </Button>
                  </form>
                )}

                <div className="flex items-start justify-between gap-4">
                  <span>
                    <span className="block text-sm font-semibold text-fg">{t("inbox.group.mute")}</span>
                    <span className="mt-0.5 block text-[11px] text-fg-secondary">{t("inbox.group.muteHint", { hours: MUTE_HOURS })}</span>
                  </span>
                  <Switch
                    checked={info.muted}
                    label={t("inbox.group.mute")}
                    onCheckedChange={(on) => void act(`/api/groups/${conversationId}/mute`, { method: "POST", headers: json, body: JSON.stringify({ hours: on ? MUTE_HOURS : null }) })}
                  />
                </div>

                <section aria-labelledby="group-members">
                  <h3 id="group-members" className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-secondary">
                    {t("inbox.group.members", { count: info.members.length })}
                  </h3>
                  <ul className="divide-y divide-border-subtle">
                    {info.members.map((m) => (
                      <li key={m.userId} className="flex items-center gap-3 py-2">
                        <Avatar size="sm" src={m.avatarUrl} defaultAvatar={{ brand: "orochia", seed: m.displayName }} fallbackSrc={defaultAvatarFor(m.displayName)} fallback={m.displayName.charAt(0)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-fg">{m.displayName}</span>
                          <span className="block truncate text-[11px] text-fg-secondary">@{m.username}</span>
                        </span>
                        {m.role === MemberRole.Owner && <Badge tone="accent" size="sm">{t("inbox.group.owner")}</Badge>}
                        {owner && !info.archived && m.userId !== myId && (
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act(`/api/groups/${conversationId}/members/${m.userId}`, { method: "DELETE" })}>
                            {t("inbox.group.remove")}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>

                {owner && !info.archived && (
                  <>
                    <section aria-labelledby="group-add">
                      <h3 id="group-add" className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-secondary">
                        {t("inbox.group.add")}
                      </h3>
                      {addable.length === 0 ? (
                        <p className="text-xs text-fg-secondary">{t("inbox.group.noContacts")}</p>
                      ) : (
                        <>
                          <ul className="max-h-48 divide-y divide-border-subtle overflow-y-auto">
                            {addable.map((c) => (
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
                              </li>
                            ))}
                          </ul>
                          <Button
                            className="mt-3"
                            variant="secondary"
                            size="sm"
                            loading={busy}
                            disabled={picked.size === 0}
                            onClick={() =>
                              void act(`/api/groups/${conversationId}/members`, { method: "POST", headers: json, body: JSON.stringify({ memberIds: [...picked] }) }, () => setPicked(new Set()))
                            }
                          >
                            <PlusIcon size={14} /> {t("inbox.group.addSelected", { count: picked.size })}
                          </Button>
                        </>
                      )}
                    </section>

                    <section aria-labelledby="group-invite">
                      <h3 id="group-invite" className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-secondary">
                        {t("inbox.group.invite")}
                      </h3>
                      <p className="mb-2 text-[11px] text-fg-secondary">{t("inbox.group.inviteHint")}</p>
                      {link ? (
                        <div className="flex gap-2">
                          <Input readOnly aria-label={t("inbox.group.inviteLink")} value={link} onFocus={(e) => e.currentTarget.select()} />
                          <Button
                            variant="secondary"
                            onClick={() => void navigator.clipboard.writeText(link).then(() => toast(t("inbox.group.copied")))}
                          >
                            {t("inbox.group.copy")}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busy}
                            onClick={async () => {
                              setBusy(true);
                              const res = await fetch(`/api/groups/${conversationId}/invites`, { method: "POST" }).catch(() => null);
                              setBusy(false);
                              if (!res?.ok) return setError(res ? await responseErrorMessage(res, t("inbox.group.actionFailed")) : t("inbox.network"));
                              setLink(`${window.location.origin}/messages/join/${((await res.json()) as { token: string }).token}`);
                            }}
                          >
                            {t("inbox.group.createLink")}
                          </Button>
                          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void act(`/api/groups/${conversationId}/invites`, { method: "DELETE" }, () => void toast(t("inbox.group.revoked")))}>
                            {t("inbox.group.revoke")}
                          </Button>
                        </div>
                      )}
                    </section>
                  </>
                )}

                <div className={cn("flex flex-wrap gap-2 border-t border-border-default pt-4")}>
                  <Button variant="outline" onClick={() => setConfirm("leave")}>
                    {t("inbox.group.leave")}
                  </Button>
                  {owner && !info.archived && (
                    <Button variant="outline" className="text-fg-danger" onClick={() => setConfirm("close")}>
                      {t("inbox.group.close")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Dialog.Body>
        </Sheet>
      </Dialog.Root>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && setConfirm(null)}
        title={confirm === "close" ? t("inbox.group.closeTitle") : t("inbox.group.leaveTitle")}
        description={confirm === "close" ? t("inbox.group.closeBody") : t("inbox.group.leaveBody")}
        confirmLabel={confirm === "close" ? t("inbox.group.close") : t("inbox.group.leave")}
        tone="danger"
        onConfirm={async () => {
          const which = confirm;
          setConfirm(null);
          if (which === "leave") {
            const ok = await act(`/api/groups/${conversationId}/leave`, { method: "POST" });
            if (ok !== false) {
              setOpen(false);
              onLeft();
            }
          } else void act(`/api/groups/${conversationId}`, { method: "DELETE" });
        }}
      />
    </>
  );
}
