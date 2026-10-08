"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Gavel, Play } from "lucide-react";
import { Button, Segmented, Sheet, Switch } from "@/components/ui";
import { usd } from "@/components/money/format";
import { t, type MessageKey } from "@/lib/i18n";

const DURATIONS = [
  { id: "1h", ms: 3600_000 },
  { id: "24h", ms: 86400_000 },
  { id: "3d", ms: 3 * 86400_000 },
  { id: "7d", ms: 7 * 86400_000 },
  { id: "custom", ms: 0 },
] as const;
type DurationId = (typeof DURATIONS)[number]["id"];

const field =
  "mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-hidden light:border-black/10 light:bg-slate-50 light:text-slate-900";
const label = "block text-xs font-semibold text-zinc-400 light:text-slate-500";
const hint = "mt-1 block text-[11px] leading-relaxed text-zinc-500 light:text-slate-500";

/** A `datetime-local` value (local time, minutes) for a date. */
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/**
 * Puts a video up for auction: starting price, when it starts (now or later), how long it runs, what the winner gets
 * (watch, or watch and download) and how it ends — the creator accepts or declines the best bid, or it sells to the
 * highest bid whatever it is. A summary reads the choice back before it is confirmed.
 */
export function StartAuctionSheet({ video, open, onClose }: { video: { id: string; title: string }; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [price, setPrice] = useState("20");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [startAt, setStartAt] = useState(() => toLocalInput(new Date(Date.now() + 3600_000)));
  const [duration, setDuration] = useState<DurationId>("3d");
  const [endAt, setEndAt] = useState(() => toLocalInput(new Date(Date.now() + 4 * 86400_000)));
  const [rights, setRights] = useState<"WATCH" | "DOWNLOAD">("WATCH");
  const [automatic, setAutomatic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceCents = Math.round(Number(price) * 100);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startsAt = when === "now" ? new Date() : new Date(startAt);
    const endsAt = duration === "custom" ? new Date(endAt) : new Date(startsAt.getTime() + DURATIONS.find((d) => d.id === duration)!.ms);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auctions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: video.id, startingPriceCents: priceCents, startsAt, endsAt, rights, settlement: automatic ? "HIGHEST_BID" : "CREATOR_DECIDES" }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      onClose();
      router.push(`/watch/${video.id}#auction`);
      return;
    }
    const data = (await res?.json().catch(() => ({}))) as { code?: string; problem?: string } | undefined;
    if (data?.code === "BAD_SCHEDULE" && data.problem) setError(t(`auction.start.problems.${data.problem}` as MessageKey));
    else if (data?.code) setError(t(`auction.errors.${data.code}` as MessageKey));
    else setError(t("auction.errors.generic"));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("auction.start.title")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button variant="primary" type="submit" form="start-auction" loading={busy} disabled={!(priceCents >= 100)} icon={<Gavel className="h-4 w-4" />}>
            {t("auction.start.submit")}
          </Button>
        </div>
      }
    >
      <form id="start-auction" onSubmit={submit} className="space-y-5">
        <p className="text-xs text-zinc-400 light:text-slate-500">{t("auction.start.intro", { title: video.title })}</p>

        <label className={label}>
          {t("auction.start.price")}
          <span className="relative mt-1 block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-zinc-500">$</span>
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" inputMode="decimal" min={1} step={0.5} required className={`${field} mt-0 pl-6 font-mono tabular-nums`} />
          </span>
          <span className={hint}>{t("auction.start.priceHint")}</span>
        </label>

        <div className={label}>
          {t("auction.start.when")}
          <div className="mt-1">
            <Segmented label={t("auction.start.when")} value={when} onChange={setWhen} options={[{ value: "now", label: t("auction.start.now") }, { value: "later", label: t("auction.start.later") }]} />
          </div>
          {when === "later" && <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required className={field} aria-label={t("auction.start.startAt")} />}
        </div>

        <div className={label}>
          {t("auction.start.duration")}
          <div className="mt-1">
            <Segmented label={t("auction.start.duration")} value={duration} onChange={setDuration} options={DURATIONS.map((d) => ({ value: d.id, label: t(`auction.start.durations.${d.id}`) }))} />
          </div>
          {duration === "custom" && <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} required className={field} aria-label={t("auction.start.endAt")} />}
          <span className={hint}>{t("auction.start.durationHint")}</span>
        </div>

        <div className={label}>
          {t("auction.start.rights")}
          <div className="mt-1">
            <Segmented
              label={t("auction.start.rights")}
              value={rights}
              onChange={setRights}
              options={[
                { value: "WATCH", label: <><Play className="h-3.5 w-3.5" aria-hidden /> {t("auction.rights.WATCH")}</> },
                { value: "DOWNLOAD", label: <><Download className="h-3.5 w-3.5" aria-hidden /> {t("auction.rights.DOWNLOAD")}</> },
              ]}
            />
          </div>
          <span className={hint}>{t("auction.start.exclusive")}</span>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 p-4 light:border-black/10">
          <span>
            <span className="block text-sm font-semibold text-white light:text-slate-900">{t("auction.start.automatic")}</span>
            <span className={hint}>{t(automatic ? "auction.start.automaticHint.on" : "auction.start.automaticHint.off")}</span>
          </span>
          <Switch checked={automatic} onChange={setAutomatic} label={t("auction.start.automatic")} />
        </div>

        {priceCents >= 100 && (
          <p className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/[0.06] px-4 py-3 text-xs leading-relaxed text-zinc-300 light:text-slate-700">
            {t("auction.start.summary", {
              price: usd(priceCents),
              when: when === "now" ? t("auction.start.nowLower") : new Date(startAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
              duration: t(`auction.start.durations.${duration}`),
              rights: t(`auction.rights.${rights}`),
            })}
          </p>
        )}
        {error && <p role="alert" className="text-xs text-rose-400 light:text-rose-600">{error}</p>}
      </form>
    </Sheet>
  );
}
