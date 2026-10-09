"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clapperboard, Megaphone, PackageCheck, Play, Undo2, X } from "lucide-react";
import { Button, ConfirmIconButton, Sheet, cx } from "@/components/ui";
import { usd } from "@/components/money/format";
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
          <Button variant="primary" loading={busy} disabled={!picked} onClick={deliver} icon={<PackageCheck className="h-4 w-4" />}>
            {t("challenge.deliver.submit", { amount: usd(c.pledgedCents) })}
          </Button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-zinc-400 light:text-slate-500">
        {t(`challenge.deliver.intro.${c.deliverable}`)} {t(`challenge.deliver.audience.${c.reward}`)}
      </p>
      {items === null ? (
        <div className="h-24 animate-pulse rounded-2xl bg-white/5 light:bg-black/5" />
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-400 light:border-black/10 light:text-slate-500">
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
              className={cx(
                "overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400",
                picked === item.id ? "border-fuchsia-500 ring-2 ring-fuchsia-500/40" : "border-white/10 hover:border-white/30 light:border-black/10",
              )}
            >
              <span className="block aspect-video bg-zinc-900">
                {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="line-clamp-1 block px-2 py-1.5 text-[11px] font-semibold text-white light:text-slate-900">
                {item.title || t("challenge.deliver.untitled")}
              </span>
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-rose-400 light:text-rose-600">
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
    <section className="space-y-3 rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/[0.05] p-4">
      {v.canAnswer && (
        <>
          <p className="text-sm text-zinc-200 light:text-slate-800">
            {t("challenge.actions.answerHint", {
              amount: usd(c.pledgedCents),
              days: c.deliveryDays,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              loading={busy === "accept"}
              onClick={() => act("accept", `${base}/answer`, { accept: true })}
              icon={<Check className="h-4 w-4" />}
            >
              {t("challenge.actions.accept")}
            </Button>
            <Button
              variant="secondary"
              loading={busy === "decline"}
              onClick={() => act("decline", `${base}/answer`, { accept: false })}
              icon={<X className="h-4 w-4" />}
            >
              {t("challenge.actions.decline")}
            </Button>
          </div>
        </>
      )}
      {v.canStart && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-200 light:text-slate-800">{t("challenge.actions.startHint", { days: c.deliveryDays })}</p>
          <Button variant="primary" loading={busy === "start"} onClick={() => act("start", `${base}/start`)} icon={<Play className="h-4 w-4" />}>
            {t("challenge.actions.start")}
          </Button>
        </div>
      )}
      {v.canDeliver && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-200 light:text-slate-800">{t(`challenge.actions.deliverHint.${c.deliverable}`)}</p>
          <Button variant="primary" onClick={() => setDelivering(true)} icon={<Clapperboard className="h-4 w-4" />}>
            {t("challenge.actions.deliver")}
          </Button>
          <DeliverSheet c={c} open={delivering} onClose={() => setDelivering(false)} onDone={onChanged} />
        </div>
      )}
      {v.canApply && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-400 light:text-slate-500">
            {t("challenge.actions.applyNote")}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              rows={2}
              className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-hidden light:border-black/10 light:bg-slate-50 light:text-slate-900"
            />
          </label>
          <Button
            variant="primary"
            loading={busy === "apply"}
            onClick={() => act("apply", `${base}/applications`, { note })}
            icon={<Megaphone className="h-4 w-4" />}
          >
            {t("challenge.actions.apply")}
          </Button>
        </div>
      )}
      {c.applications.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400 light:text-slate-500">
            {t(v.canAssign ? "challenge.actions.pickTitle" : "challenge.actions.applicationsTitle")}
          </p>
          <ul className="space-y-2">
            {c.applications.map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-xl border border-white/10 p-3 light:border-black/10">
                <img src={a.creator.avatarUrl || AVATAR_PLACEHOLDER} alt="" className="h-9 w-9 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <Link href={`/@${a.creator.username}`} className="text-sm font-semibold text-white hover:underline light:text-slate-900">
                    {a.creator.name}
                  </Link>
                  {a.note && <p className="mt-0.5 text-xs text-zinc-400 light:text-slate-500">{a.note}</p>}
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-fuchsia-300 light:text-fuchsia-700">
                    {t(`challenge.application.${a.status as "PENDING"}`)}
                  </p>
                </div>
                {v.canAssign && a.status === "PENDING" && (
                  <Button size="sm" variant="primary" loading={busy === a.id} onClick={() => act(a.id, `${base}/assign`, { applicationId: a.id })}>
                    {t("challenge.actions.pick")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {v.canCancel && (
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3 first:border-t-0 first:pt-0 light:border-black/10">
          <p className="text-xs text-zinc-400 light:text-slate-500">{t("challenge.actions.cancelHint")}</p>
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
        <p role="alert" className="text-xs text-rose-400 light:text-rose-600">
          {error}
        </p>
      )}
    </section>
  );
}
