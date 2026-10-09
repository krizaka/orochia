"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Download, Gavel, Info, Play, ShieldCheck, Sparkles, Timer, Trophy, Wallet, X } from "lucide-react";
import { Button, Chip, cn, ConfirmIconButton, Countdown, Input, LiveBadge, orochiaButton, Spinner } from "@/components/ui";
import { money } from "@/lib/money";
import { timeAgo } from "@/components/notifications/useNotifications";
import { t, type MessageKey } from "@/lib/i18n";
import type { Auction } from "./types";

const UNITS = () => ({ d: t("auction.units.d"), h: t("auction.units.h"), m: t("auction.units.m"), s: t("auction.units.s") });

/** The status pill of an auction phase. */
export function AuctionStatusBadge({ phase, className }: { phase: Auction["phase"]; className?: string }) {
  const tone = phase === "OPEN" ? "live" : phase === "UPCOMING" ? "upcoming" : phase === "SOLD" ? "success" : "muted";
  return <LiveBadge label={t(`auction.phase.${phase}`)} tone={tone} className={className} />;
}

const bidderName = (alias: number, mine: boolean) => (mine ? t("auction.you") : t("auction.bidder", { n: alias }));

/**
 * An auction on the watch page, kept current: price, countdown (aligned on the server clock), the viewer's standing, the bid
 * form with one-tap amounts, the bid history under aliases, and — for its creator — cancel, accept or decline. Every
 * state of the auction has its screen: upcoming, open, closing, awaiting the creator, sold, declined, unsold, cancelled.
 */
export function AuctionPanel({
  auction,
  skewMs,
  pulse,
  onChanged,
  onOwnBid,
}: {
  auction: Auction;
  skewMs: number;
  pulse: number;
  onChanged: () => void;
  onOwnBid: (alias: number, balanceCents: number) => void;
}) {
  const a = auction;
  const { viewer } = a;
  // What the bidder typed, kept while it still reaches the minimum; a new minimum (someone bid) replaces a lower one.
  const [typed, setTyped] = useState<string | null>(null);
  const minimumText = (a.minimumNextBidCents / 100).toFixed(2);
  const amount = typed !== null && (typed === "" || Math.round(Number(typed) * 100) >= a.minimumNextBidCents || typed.length < minimumText.length) ? typed : minimumText;
  const setAmount = setTyped;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; topUp?: boolean } | null>(null);
  const [placed, setPlaced] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const extended = new Date(a.endsAt) > new Date(a.scheduledEndsAt);

  const bid = async (cents: number) => {
    setBusy(true);
    setError(null);
    setPlaced(false);
    const res = await fetch(`/api/auctions/${a.id}/bids`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents: cents }) }).catch(() => null);
    setBusy(false);
    const data = (await res?.json().catch(() => ({}))) as { alias?: number; balanceCents?: number; code?: string; minimum?: number; balance?: number } | undefined;
    if (res?.ok && data?.alias !== undefined) {
      onOwnBid(data.alias, data.balanceCents ?? 0);
      setPlaced(true);
      return;
    }
    const code = data?.code;
    if (code === "INSUFFICIENT_CREDITS") setError({ text: t("auction.errors.INSUFFICIENT_CREDITS", { balance: money(data?.balance ?? 0) }), topUp: true });
    else if (code === "BID_TOO_LOW") setError({ text: t("auction.errors.BID_TOO_LOW", { minimum: money(data?.minimum ?? a.minimumNextBidCents) }) });
    else if (code) setError({ text: t(`auction.errors.${code}` as MessageKey) });
    else setError({ text: t("auction.errors.generic") });
    if (code === "NOT_OPEN") onChanged();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < a.minimumNextBidCents) {
      setError({ text: t("auction.errors.BID_TOO_LOW", { minimum: money(a.minimumNextBidCents) }) });
      return;
    }
    void bid(cents);
  };

  const act = async (method: "DELETE" | "POST", path: string, body?: object) => {
    setBusy(true);
    setError(null);
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => ({}))) as { code?: string } | undefined;
      setError({ text: data?.code ? t(`auction.errors.${data.code}` as MessageKey) : t("auction.errors.generic") });
    }
    onChanged();
  };

  const download = async () => {
    setDownloading(true);
    const res = await fetch(`/api/videos/${a.video.id}/download`).catch(() => null);
    setDownloading(false);
    const data = (await res?.json().catch(() => ({}))) as { url?: string } | undefined;
    if (data?.url) window.location.assign(data.url);
    else setError({ text: t("auction.errors.download") });
  };

  const open = a.phase === "OPEN";
  const priceLabel = a.bidsCount > 0 ? t(a.status === "SOLD" ? "auction.soldFor" : "auction.currentBid") : t("auction.startingPrice");
  const price = a.bidsCount > 0 ? a.highestBidCents : a.startingPriceCents;

  return (
    <section id="auction" aria-labelledby="auction-title" className="scroll-mt-24 overflow-hidden rounded-3xl border border-accent/25 bg-surface-1/70 shadow-xl shadow-accent/20">
      {/* Head: what is sold, how it ends */}
      <div className="relative bg-[radial-gradient(120%_140%_at_0%_0%,rgba(139,92,246,0.35),transparent_60%),radial-gradient(100%_120%_at_100%_100%,rgba(236,72,153,0.28),transparent_60%)] px-5 pt-5 pb-4 light:bg-[radial-gradient(120%_140%_at_0%_0%,rgba(139,92,246,0.14),transparent_60%),radial-gradient(100%_120%_at_100%_100%,rgba(236,72,153,0.12),transparent_60%)]">
        <div className="flex flex-wrap items-center gap-2">
          <AuctionStatusBadge phase={a.phase} />
          <span className="inline-flex items-center gap-1 rounded-full border border-border-default px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fg-secondary">
            {a.rights === "DOWNLOAD" ? <Download className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
            {t(`auction.rights.${a.rights}`)}
          </span>
          {extended && open && (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-warning">
              <Timer className="h-3 w-3" aria-hidden /> {t("auction.extended")}
            </span>
          )}
        </div>
        <h2 id="auction-title" className="sr-only">{t("auction.title")}</h2>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{priceLabel}</p>
            <p key={pulse} className="kz-fade font-display text-4xl font-black tabular-nums tracking-tight text-fg">{money(price)}</p>
            <p className="mt-0.5 text-xs text-fg-secondary">
              {t("auction.counts", { bids: a.bidsCount, bidders: a.biddersCount })}
            </p>
          </div>
          <div className="text-right">
            {a.phase === "UPCOMING" && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">{t("auction.startsIn")}</p>
                <Countdown label={t("auction.startsIn")} target={a.startsAt} skewMs={skewMs} units={UNITS()} />
              </>
            )}
            {open && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">{t("auction.endsIn")}</p>
                <Countdown label={t("auction.endsIn")} target={a.endsAt} skewMs={skewMs} units={UNITS()} />
              </>
            )}
            {a.phase === "ENDING" && (
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-fg-secondary">
                <Spinner size="sm" className="text-current" label={t("auction.closing")} /> {t("auction.closing")}
              </p>
            )}
            {a.phase === "AWAITING_DECISION" && a.decisionDeadline && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">{t("auction.decisionIn")}</p>
                <Countdown label={t("auction.decisionIn")} target={a.decisionDeadline} skewMs={skewMs} units={UNITS()} size="sm" urgentBelowMs={3600_000} />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* The viewer's standing */}
        <Standing auction={a} />

        {/* Bid form */}
        {open && !viewer.isCreator && viewer.signedIn && (
          <form onSubmit={submit} className="space-y-3" aria-label={t("auction.placeBid")}>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("auction.quickBids")}>
              {a.suggestedBidsCents.map((cents) => (
                <Chip key={cents} active={Math.round(Number(amount) * 100) === cents} onClick={() => setAmount((cents / 100).toFixed(2))} className="h-10 w-full font-mono tabular-nums">
                  {money(cents)}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">{t("auction.yourBid")}</span>
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-fg-muted">$</span>
                <Input
                  inputMode="decimal"
                  type="number"
                  min={a.minimumNextBidCents / 100}
                  step="0.5"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 rounded-xl pl-7 pr-3 font-mono text-base font-semibold tabular-nums"
                />
              </label>
              <Button
                type="submit"
                variant="sensual"
                size="lg"
                shape="rounded"
                loading={busy}
                className="kz-sheen shrink-0"><Gavel className="h-4 w-4" />
                {t("auction.placeBid")}
              </Button>
            </div>
            <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-muted">
              <span>{t("auction.minimum", { amount: money(a.minimumNextBidCents) })}</span>
              {viewer.balanceCents !== null && (
                <Link href="/wallet" className="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent">
                  <Wallet className="h-3 w-3" aria-hidden /> {t("auction.balance", { amount: money(viewer.balanceCents) })}
                </Link>
              )}
            </p>
          </form>
        )}

        {(open || a.phase === "UPCOMING") && !viewer.signedIn && (
          <Link href={`/auth/login?next=/watch/${a.video.id}%23auction`} className={orochiaButton({ variant: "sensual", size: "lg", shape: "rounded", className: "w-full" })}>
            <Gavel className="h-4 w-4" /> {t("auction.signInToBid")}
          </Link>
        )}

        {/* The creator's controls */}
        {viewer.isCreator && a.phase === "AWAITING_DECISION" && (
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <Button
              variant="sensual"
              size="lg"
              shape="rounded"
              loading={busy}
              onClick={() => void act("POST", `/api/auctions/${a.id}/decision`, { accept: true })}>
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {t("auction.accept", { amount: money(a.highestBidCents) })}
            </Button>
            <ConfirmIconButton label={t("auction.decline")} confirmLabel={t("auction.declineConfirm")} disabled={busy} onConfirm={() => void act("POST", `/api/auctions/${a.id}/decision`, { accept: false })}>
              <X className="h-4 w-4" />
            </ConfirmIconButton>
          </div>
        )}
        {viewer.isCreator && a.status === "OPEN" && a.bidsCount === 0 && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface-2 px-4 py-3">
            <span className="text-xs text-fg-secondary">{t("auction.cancelHint")}</span>
            <ConfirmIconButton label={t("auction.cancel")} confirmLabel={t("auction.cancelConfirm")} disabled={busy} onConfirm={() => void act("DELETE", `/api/auctions/${a.id}`)}>
              <X className="h-4 w-4" />
            </ConfirmIconButton>
          </div>
        )}

        {/* The winner's access */}
        {(viewer.won || (viewer.isCreator && a.status === "SOLD")) && viewer.canDownload && a.rights === "DOWNLOAD" && (
          <Button
            variant="secondary"
            size="lg"
            shape="rounded"
            className="w-full"
            loading={downloading}
            onClick={() => void download()}>
            <Download className="h-4 w-4" aria-hidden />
            {t("auction.download")}
          </Button>
        )}

        {placed && !error && (
          <p role="status" className="kz-fade flex items-center gap-1.5 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {t("auction.placed")}
          </p>
        )}
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error.text}{" "}
            {error.topUp && (
              <Link href="/wallet" className="font-semibold underline underline-offset-2">
                {t("auction.topUp")}
              </Link>
            )}
          </p>
        )}

        {/* History */}
        <div>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-fg-secondary">{t("auction.history")}</h3>
          {a.recentBids.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-default px-4 py-5 text-center text-xs text-fg-muted">
              {a.phase === "UPCOMING" ? t("auction.noBidsYetUpcoming") : t("auction.noBidsYet")}
            </p>
          ) : (
            <ol className="divide-y divide-border-subtle" aria-live="polite">
              {a.recentBids.map((b, i) => (
                <li key={b.id} className={cn("flex items-center gap-3 py-2.5", i === 0 && "kz-fade")}>
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black", b.mine ? "bg-accent text-white" : "bg-surface-2 text-fg-secondary")}>
                    {b.mine ? t("auction.youShort") : b.alias}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{bidderName(b.alias, b.mine)}</span>
                    <span className="block text-[11px] text-fg-muted">{timeAgo(b.createdAt)}</span>
                  </span>
                  {i === 0 && a.status !== "DECLINED" && a.status !== "CANCELLED" && <Trophy className="h-3.5 w-3.5 text-warning" aria-label={t("auction.leading")} />}
                  <span className="font-mono text-sm font-semibold tabular-nums text-fg">{money(b.amountCents)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* How it works */}
        <details className="group rounded-2xl border border-border-subtle bg-surface-2 px-4 py-3 text-xs text-fg-secondary">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-fg-secondary [&::-webkit-details-marker]:hidden">
            <Info className="h-3.5 w-3.5" aria-hidden /> {t("auction.howTitle")}
          </summary>
          <ul className="mt-2 space-y-1.5">
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />{t("auction.how.held")}</li>
            <li className="flex gap-2"><Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />{t("auction.how.softClose")}</li>
            <li className="flex gap-2"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />{t(`auction.how.${a.settlement}`)}</li>
            <li className="flex gap-2"><Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />{t(`auction.how.rights.${a.rights}`)}</li>
          </ul>
        </details>
      </div>
    </section>
  );
}

/** One line on where the viewer stands: leading, outbid, won, awaiting the creator, the creator's view… */
function Standing({ auction: a }: { auction: Auction }) {
  const v = a.viewer;
  let tone: "ok" | "warn" | "info" = "info";
  let text: string | null = null;
  if (v.isCreator) {
    if (a.status === "SOLD") [tone, text] = ["ok", t("auction.standing.creatorSold", { amount: money(a.highestBidCents), username: a.leaderUsername ?? "" })];
    else if (a.phase === "AWAITING_DECISION") text = t("auction.standing.creatorDecide", { amount: money(a.highestBidCents), username: a.leaderUsername ?? t("auction.bidder", { n: a.leaderAlias ?? 0 }) });
    else if (a.phase === "OPEN" && a.bidsCount > 0) text = t("auction.standing.creatorLeader", { username: a.leaderUsername ?? t("auction.bidder", { n: a.leaderAlias ?? 0 }) });
    else if (a.settlement === "HIGHEST_BID" && (a.phase === "OPEN" || a.phase === "UPCOMING")) text = t("auction.standing.creatorAutomatic");
  } else if (v.won) {
    [tone, text] = ["ok", t(a.rights === "DOWNLOAD" ? "auction.standing.wonDownload" : "auction.standing.won")];
  } else if (a.phase === "AWAITING_DECISION" && v.isLeader) {
    text = t("auction.standing.underReview", { amount: money(a.highestBidCents) });
  } else if (a.phase === "OPEN" && v.isLeader) {
    [tone, text] = ["ok", t("auction.standing.leading")];
  } else if (a.phase === "OPEN" && v.alias !== null) {
    [tone, text] = ["warn", t("auction.standing.outbid")];
  } else if (a.status === "SOLD") {
    text = t("auction.standing.soldOther");
  } else if (a.status === "DECLINED" || a.status === "UNSOLD" || a.status === "CANCELLED") {
    text = t(`auction.standing.${a.status}`);
  }
  if (!text) return null;
  const styles = {
    ok: "border-success/30 bg-success/10 text-success",
    warn: "border-warning/30 bg-warning/10 text-warning",
    info: "border-border-default bg-surface-2 text-fg-secondary",
  }[tone];
  return (
    <p role="status" className={cn("flex items-start gap-2 rounded-2xl border px-4 py-3 text-xs font-medium leading-relaxed", styles)}>
      {tone === "ok" ? <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : tone === "warn" ? <Gavel className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
      <span>{text}</span>
    </p>
  );
}
