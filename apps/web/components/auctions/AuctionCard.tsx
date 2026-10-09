"use client";

import React from "react";
import Link from "next/link";
import { Download, Gavel, Play, Trophy } from "lucide-react";
import { Countdown } from "@/components/ui";
import { money } from "@/lib/money";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { AuctionStatusBadge } from "./AuctionPanel";
import type { AuctionCard as Card } from "./types";

const UNITS = () => ({ d: t("auction.units.d"), h: t("auction.units.h"), m: t("auction.units.m"), s: t("auction.units.s") });

/** An auction in a list: picture, state, price, countdown, creator — the whole card opens its watch page. */
export function AuctionCard({ auction: a, index = 0 }: { auction: Card; index?: number }) {
  const price = a.bidsCount > 0 ? a.highestBidCents : a.startingPriceCents;
  return (
    <Link
      href={`/watch/${a.videoId}#auction`}
      data-reveal
      style={{ "--kz-delay": `${Math.min(index, 8) * 50}ms` } as React.CSSProperties}
      className="kz-spotlight kz-lift group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/70 transition-colors hover:border-fuchsia-500/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400 light:border-black/5 light:bg-white hover:light:border-fuchsia-500/40"
    >
      <div className="relative aspect-video overflow-hidden bg-zinc-900">
        {a.thumbnailUrl ? (
          <img src={a.thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-violet-950/40 via-zinc-950 to-fuchsia-950/40 light:from-violet-100 light:via-slate-50 light:to-fuchsia-100">
            <Gavel className="h-10 w-10 text-fuchsia-400/60" />
          </div>
        )}
        <div className="theme-dark absolute left-2.5 top-2.5 flex gap-1.5">
          <AuctionStatusBadge phase={a.phase} className="bg-black/55" />
          {a.leading && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              <Trophy className="h-3 w-3" aria-hidden /> {t(a.phase === "SOLD" ? "auction.phase.SOLD" : "auction.leading")}
            </span>
          )}
        </div>
        <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
          {a.rights === "DOWNLOAD" ? <Download className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
          {t(`auction.rights.${a.rights}`)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="line-clamp-1 text-sm font-semibold text-white group-hover:text-fuchsia-300 light:text-slate-900 group-hover:light:text-fuchsia-700">{a.title}</h3>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 light:text-slate-500">
              {a.bidsCount > 0 ? t(a.phase === "SOLD" ? "auction.soldFor" : "auction.currentBid") : t("auction.startingPrice")}
            </p>
            <p className="font-display text-xl font-black tabular-nums text-white light:text-slate-900">{money(price)}</p>
          </div>
          {a.phase === "OPEN" && <Countdown label={t("auction.endsIn")} target={a.endsAt} units={UNITS()} size="sm" />}
          {a.phase === "UPCOMING" && <Countdown label={t("auction.startsIn")} target={a.startsAt} units={UNITS()} size="sm" />}
        </div>
        <div className="mt-auto flex items-center gap-2 border-t border-white/5 pt-3 text-xs text-zinc-400 light:border-black/5 light:text-slate-500">
          <img src={a.creatorAvatar || AVATAR_PLACEHOLDER} alt="" className="h-5 w-5 rounded-full object-cover" />
          <span className="min-w-0 flex-1 truncate">{a.creatorName}</span>
          <span className="shrink-0 tabular-nums">{t("auction.bids", { count: a.bidsCount })}</span>
        </div>
      </div>
    </Link>
  );
}
