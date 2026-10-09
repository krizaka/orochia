"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clapperboard, Megaphone, PackageCheck, Play, Undo2, X } from "lucide-react";
import { Avatar, Button, cn, ConfirmIconButton, Sheet, Skeleton, Textarea } from "@/components/ui";
import { money } from "@/lib/money";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import type { ChallengeView } from "@/lib/challenges";
import { errorText, postJson } from "./PledgeBox";

type Option = { id: string; title: string; thumbnailUrl: string | null };

/** The creator picks what they deliver: a ready video of theirs, or a story posted since they committed. */
function DeliverSheet({ c, open, onClose, onDone }: { c: ChallengeView; open: boolean; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState<Option[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    void fetch(`/api/challenges/${c.id}/delivery`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { items?: Option[] }) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, [open, c.id]);
  const deliver = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const { ok, data } = await postJson(`/api/challenges/${c.id}/delivery`, c.deliverable === "VIDEO" ? { videoId: picked } : { storyId: picked });
    setBusy(false);
    if (ok) {
      onClose();
      onDone();
    } else setError(errorText(data));
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("challenge.deliver.title")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="sensual" loading={busy} disabled={!picked} onClick={deliver}>
            <PackageCheck className="h-4 w-4" aria-hidden />
            {t("challenge.deliver.submit", { amount: money(c.pledgedCents) })}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-fg-secondary">
        {t(`challenge.deliver.intro.${c.deliverable}`)} {t(`challenge.deliver.audience.${c.reward}`)}
      </p>
      {items === null ? (
        <Skeleton shape="rect" className="h-24 rounded-2xl" />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-default p-6 text-center text-sm text-fg-secondary">
          {t(`challenge.deliver.none.${c.deliverable}`)}
        </p>
      ) : (
        <div role="radiogroup" aria-label={t("challenge.deliver.title")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={picked === item.id}
              onClick={() => setPicked(item.id)}
              className={cn(
                "overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                picked === item.id ? "border-accent ring-2 ring-accent/40" : "border-border-default hover:border-white/30",
              )}
            >
              <span className="block aspect-video bg-zinc-900">
                {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="line-clamp-1 block px-2 py-1.5 text-[11px] font-semibold text-fg">
                {item.title || t("challenge.deliver.untitled")}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}
    </Sheet>
  );
}

/**
 * What the people of a challenge do with it, each in place: the dared creator accepts or declines; a goal's creator
 * starts once it is reached; creators apply to an open call and its author picks one; the creator delivers; the author
 * withdraws while it is open. Every action reloads the challenge.
 */
export function ChallengeActions({ c, onChanged }: { c: ChallengeView; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [delivering, setDelivering] = useState(false);
  const act = async (key: string, url: string, body?: unknown) => {
    setBusy(key);
    setError(null);
    const { ok, data } = await postJson(url, body);
    setBusy(null);
    if (ok) onChanged();
    else setError(errorText(data));
  };
  const v = c.viewer;
  const base = `/api/challenges/${c.id}`;
  if (!v.canAnswer && !v.canStart && !v.canApply && !v.canAssign && !v.canDeliver && !v.canCancel && c.applications.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-accent/25 bg-accent/[0.05] p-4">
      {v.canAnswer && (
        <>
          <p className="text-sm text-fg">
            {t("challenge.actions.answerHint", {
              amount: money(c.pledgedCents),
              days: c.deliveryDays,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="sensual"
              loading={busy === "accept"}
              onClick={() => act("accept", `${base}/answer`, { accept: true })}>
              <Check className="h-4 w-4" aria-hidden />
              {t("challenge.actions.accept")}
            </Button>
            <Button
              variant="secondary"
              loading={busy === "decline"}
              onClick={() => act("decline", `${base}/answer`, { accept: false })}>
              <X className="h-4 w-4" aria-hidden />
              {t("challenge.actions.decline")}
            </Button>
          </div>
        </>
      )}
      {v.canStart && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg">{t("challenge.actions.startHint", { days: c.deliveryDays })}</p>
          <Button
            variant="sensual"
            loading={busy === "start"}
            onClick={() => act("start", `${base}/start`)}>
            <Play className="h-4 w-4" aria-hidden />
            {t("challenge.actions.start")}
          </Button>
        </div>
      )}
      {v.canDeliver && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg">{t(`challenge.actions.deliverHint.${c.deliverable}`)}</p>
          <Button variant="sensual" onClick={() => setDelivering(true)}>
            <Clapperboard className="h-4 w-4" aria-hidden />
            {t("challenge.actions.deliver")}
          </Button>
          <DeliverSheet c={c} open={delivering} onClose={() => setDelivering(false)} onDone={onChanged} />
        </div>
      )}
      {v.canApply && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-fg-secondary">
            {t("challenge.actions.applyNote")}
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              rows={2}
              className="mt-1 rounded-xl px-3 py-2"
            />
          </label>
          <Button
            variant="sensual"
            loading={busy === "apply"}
            onClick={() => act("apply", `${base}/applications`, { note })}>
            <Megaphone className="h-4 w-4" aria-hidden />
            {t("challenge.actions.apply")}
          </Button>
        </div>
      )}
      {c.applications.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-fg-secondary">
            {t(v.canAssign ? "challenge.actions.pickTitle" : "challenge.actions.applicationsTitle")}
          </p>
          <ul className="space-y-2">
            {c.applications.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-xl border border-border-default p-3">
                <Avatar src={a.creator.avatarUrl || AVATAR_PLACEHOLDER} fallback={a.creator.name.charAt(0)} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <Link href={`/@${a.creator.username}`} className="text-sm font-semibold text-fg hover:underline">
                    {a.creator.name}
                  </Link>
                  {a.note && <p className="mt-0.5 text-xs text-fg-secondary">{a.note}</p>}
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                    {t(`challenge.application.${a.status as "PENDING"}`)}
                  </p>
                </div>
                {v.canAssign && a.status === "PENDING" && (
                  <Button size="sm" variant="sensual" loading={busy === a.id} onClick={() => act(a.id, `${base}/assign`, { applicationId: a.id })}>
                    {t("challenge.actions.pick")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {v.canCancel && (
        <div className="flex items-center justify-between gap-3 border-t border-border-default pt-3 first:border-t-0 first:pt-0">
          <p className="text-xs text-fg-secondary">{t("challenge.actions.cancelHint")}</p>
          <ConfirmIconButton
            label={t("challenge.actions.cancel")}
            confirmLabel={t("challenge.actions.cancelConfirm")}
            onConfirm={() => act("cancel", `${base}/cancel`)}
          >
            <Undo2 className="h-4 w-4" />
          </ConfirmIconButton>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
