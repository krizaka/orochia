"use client";

import React, { useEffect, useRef, useState } from "react";
import { BadgeCheck, Coins, Eye, Gavel, Lock, Sparkles, TrendingUp, Users } from "lucide-react";
import { t } from "@/lib/i18n";

const BARS = [36, 48, 42, 58, 54, 70, 64, 82, 76, 92, 86, 100];

/** Counts from 0 to `to` once `active` turns on (ease-out), or shows it at once under reduced motion. */
function useCountUp(to: number, active: boolean, ms = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setValue(to);
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, active, ms]);
  return value;
}

/**
 * A creator's revenue dashboard at a glance — demonstrating tips, auctions, and paid unlocks.
 */
export function CreatorsPreview() {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.35 });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);
  const earned = useCountUp(482_350, seen);
  const views = useCountUp(128_400, seen);
  const fans = useCountUp(1_240, seen);

  return (
    <div ref={box} aria-hidden className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-4xl bg-linear-to-tr from-violet-600/35 via-fuchsia-600/25 to-pink-500/25 blur-2xl light:from-violet-300/40 light:to-pink-200/40" />
      <div className="rounded-[2rem] border border-white/15 bg-zinc-950/85 p-6 shadow-2xl backdrop-blur-2xl light:border-black/5 light:bg-white/95">
        {/* Creator Identity Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 light:border-black/5">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <img
                src="/showcase/stream-elena.jpg"
                alt=""
                className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-500 shadow-md"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-black" />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-white light:text-slate-900">{t("home.showcase.demo.creatorElena")}</span>
                <BadgeCheck className="h-3 w-3 text-violet-400" />
              </div>
              <span className="text-[10px] text-zinc-400 light:text-slate-500">{t("home.creatorsPreview.title")}</span>
            </div>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 light:text-emerald-700">
            <TrendingUp className="h-3 w-3" /> +24%
          </span>
        </div>

        {/* Total Earned */}
        <div className="mt-4">
          <p className="text-[11px] font-medium text-zinc-400 light:text-slate-500">{t("home.creatorsPreview.earned")}</p>
          <p className="font-display text-4xl font-black tabular-nums tracking-tight text-white light:text-slate-900 mt-0.5">
            ${(earned / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Revenue Streams Breakdown */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-xl bg-white/5 p-2 light:bg-black/5">
            <div className="flex items-center justify-center gap-1 text-[9px] font-semibold text-emerald-400">
              <Coins className="h-2.5 w-2.5" /> {t("home.creatorsPreview.tips")}
            </div>
            <p className="font-mono text-[11px] font-bold text-white light:text-slate-900 mt-0.5">$2,840</p>
          </div>
          <div className="rounded-xl bg-white/5 p-2 light:bg-black/5">
            <div className="flex items-center justify-center gap-1 text-[9px] font-semibold text-amber-400">
              <Gavel className="h-2.5 w-2.5" /> {t("home.creatorsPreview.auctions")}
            </div>
            <p className="font-mono text-[11px] font-bold text-white light:text-slate-900 mt-0.5">$1,420</p>
          </div>
          <div className="rounded-xl bg-white/5 p-2 light:bg-black/5">
            <div className="flex items-center justify-center gap-1 text-[9px] font-semibold text-pink-400">
              <Lock className="h-2.5 w-2.5" /> {t("home.creatorsPreview.unlocks")}
            </div>
            <p className="font-mono text-[11px] font-bold text-white light:text-slate-900 mt-0.5">$563</p>
          </div>
        </div>

        {/* Dynamic Growth Bars */}
        <div className="mt-4 flex h-20 items-end gap-[3px]">
          {BARS.map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-t-[4px] transition-[height] duration-700 ease-(--kz-ease) ${
                i === BARS.length - 1
                  ? "bg-linear-to-t from-pink-500 to-amber-300 shadow-xs shadow-pink-500/50"
                  : "bg-linear-to-t from-violet-600 to-fuchsia-500"
              }`}
              style={{ height: seen ? `${h}%` : "4%", transitionDelay: `${i * 40}ms` }}
            />
          ))}
        </div>

        {/* Audience Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {[
            { icon: Eye, label: t("home.creatorsPreview.views"), value: views.toLocaleString("en-US") },
            { icon: Users, label: t("home.creatorsPreview.supporters"), value: fans.toLocaleString("en-US") },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl bg-white/4 p-2.5 light:bg-black/3 border border-white/5">
              <p className="flex items-center gap-1.5 text-[10px] text-zinc-400 light:text-slate-500">
                <Icon className="h-3 w-3 text-violet-400" /> {label}
              </p>
              <p className="font-mono text-sm font-bold tabular-nums text-white light:text-slate-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Payout Security Notice */}
        <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-zinc-400 light:text-slate-500">
          <Sparkles className="h-3 w-3 text-emerald-400" />
          <span>{t("home.creatorsPreview.payoutBadge")}</span>
        </div>
      </div>

      {/* Floating Real-time Tip Alert */}
      <div
        className="absolute -right-4 -top-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-zinc-900/95 px-3 py-2 text-xs font-semibold text-white shadow-2xl backdrop-blur-md transition-all duration-700 ease-(--kz-ease) light:border-black/5 light:bg-white light:text-slate-800"
        style={{ opacity: seen ? 1 : 0, transform: seen ? "none" : "translateY(-12px) scale(.95)", transitionDelay: "800ms" }}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
          <Coins className="h-3.5 w-3.5" />
        </span>
        {t("home.creatorsPreview.newTip")}
      </div>
    </div>
  );
}
