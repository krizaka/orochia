"use client";

import React, { useEffect, useRef, useState } from "react";
import { Coins, Gavel, Landmark, Lock, ShieldCheck } from "lucide-react";
import { t } from "@/lib/i18n";

const SOURCES = [
  ["tips", Coins, "from-warning to-warning"],
  ["unlocks", Lock, "from-accent to-accent-2"],
  ["auctions", Gavel, "from-accent-2 to-accent-2"],
] as const;

/**
 * How a creator is paid on Orochia — the three ways money comes in and where each payment goes, drawn from the
 * platform's own rules (the creator's share is the configured fee, nothing else). No account, no figures that would
 * pretend to be someone's earnings. The split fills once it scrolls into view; still under prefers-reduced-motion.
 */
export function CreatorsPreview({ share }: { share: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.15 });
    if (box.current) io.observe(box.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-4xl bg-linear-to-tr from-accent/35 via-accent-2/25 to-accent-2/25 blur-2xl"
      />
      <div className="rounded-[2rem] border border-border-strong bg-surface-1/85 p-6 shadow-2xl backdrop-blur-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{t("home.creatorsPreview.title")}</p>
        <ul className="mt-4 space-y-2.5">
          {SOURCES.map(([key, Icon, tone], i) => (
            <li
              key={key}
              className={`flex items-center gap-3 rounded-2xl border border-border-default bg-surface-2 p-3 ${seen ? "cp-in" : "opacity-0"}`}
              style={{ animationDelay: `${i * 140}ms` }}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${tone} text-white shadow-md`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-fg">{t(`home.creatorsPreview.${key}.title`)}</span>
                <span className="block text-xs text-fg-secondary">{t(`home.creatorsPreview.${key}.body`)}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <div className="mb-2 flex items-baseline justify-between text-xs font-semibold">
            <span className="text-success">{t("home.creatorsPreview.creator", { share })}</span>
            <span className="text-zinc-500">{t("home.creatorsPreview.platform", { fee: 100 - share })}</span>
          </div>
          <div
            className="flex h-3 overflow-hidden rounded-full bg-surface-3"
            role="img"
            aria-label={t("home.creatorsPreview.split", { share })}
          >
            <span
              className={`h-full rounded-full bg-linear-to-r from-success to-teal-400 ${seen ? "cp-grow" : "scale-x-0"}`}
              style={{ width: `${share}%` }}
            />
          </div>
        </div>

        <ul className="mt-5 space-y-1.5 text-[11px] text-fg-secondary">
          <li className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden /> {t("home.creatorsPreview.confirmed")}
          </li>
          <li className="flex items-center gap-2">
            <Landmark className="h-3.5 w-3.5 text-accent" aria-hidden /> {t("home.creatorsPreview.payout")}
          </li>
        </ul>
      </div>
      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
        .cp-in { animation: cp-in .6s cubic-bezier(.16,1,.3,1) both; }
        @keyframes cp-in { from { opacity: 0; transform: translateY(10px); } }
        .cp-grow { transform-origin: left; animation: cp-grow 1.4s .4s cubic-bezier(.16,1,.3,1) both; }
        @keyframes cp-grow { from { transform: scaleX(0); } }
        @media (prefers-reduced-motion: reduce) { .cp-in, .cp-grow { animation: none; opacity: 1; transform: none; } }
`;
