"use client";

import React, { useEffect, useRef, useState } from "react";
import { Coins, Eye, TrendingUp, Users } from "lucide-react";
import { t } from "@/lib/i18n";

const BARS = [38, 52, 44, 61, 58, 72, 66, 84, 79, 92, 88, 100];

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
 * A creator's month at a glance — the "For creators" pitch made visible: figures count up and the bars grow when it
 * scrolls into view, a new tip drops in. Illustrative figures (the section says so through its copy), never real data.
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
      <div className="absolute -inset-6 -z-10 rounded-4xl bg-linear-to-tr from-violet-600/30 to-pink-500/20 blur-2xl light:from-violet-300/40 light:to-pink-200/40" />
      <div className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-5 shadow-2xl backdrop-blur-xl light:border-black/5 light:bg-white/90">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-400 light:text-slate-500">{t("home.creatorsPreview.title")}</span>
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 light:text-emerald-700">
            <TrendingUp className="h-3 w-3" /> +24%
          </span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">{t("home.creatorsPreview.earned")}</p>
        <p className="font-display text-4xl font-black tabular-nums tracking-tight text-white light:text-slate-900">${(earned / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <div className="mt-4 flex h-24 items-end gap-[3px]">
          {BARS.map((h, i) => (
            <span
              key={i}
              className="flex-1 rounded-t-[4px] bg-linear-to-t from-violet-600 to-fuchsia-500 transition-[height] duration-700 ease-(--kz-ease)"
              style={{ height: seen ? `${h}%` : "4%", transitionDelay: `${i * 45}ms` }}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { icon: Eye, label: t("home.creatorsPreview.views"), value: views.toLocaleString("en-US") },
            { icon: Users, label: t("home.creatorsPreview.supporters"), value: fans.toLocaleString("en-US") },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl bg-white/4 p-3 light:bg-black/3">
              <p className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <Icon className="h-3 w-3" /> {label}
              </p>
              <p className="font-mono text-sm font-bold tabular-nums text-white light:text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div
        className="absolute -right-4 -top-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/90 px-3 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-sm transition-all duration-700 ease-(--kz-ease) light:border-black/5 light:bg-white light:text-slate-800"
        style={{ opacity: seen ? 1 : 0, transform: seen ? "none" : "translateY(-12px) scale(.95)", transitionDelay: "900ms" }}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Coins className="h-3.5 w-3.5" />
        </span>
        {t("home.creatorsPreview.newTip")}
      </div>
    </div>
  );
}
