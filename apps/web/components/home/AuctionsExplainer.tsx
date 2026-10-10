import { AuctionIcon, ClockIcon, LockIcon, UnlockIcon } from "@krizaka/icons";
import { AUCTION_DECISION_WINDOW_MS, AUCTION_SOFT_CLOSE_MS } from "@orochia/payments";
import Link from "next/link";
import React from "react";

import { buttonVariants, cn } from "@/components/ui";
import { t } from "@/lib/i18n";

const STEPS = [
  ["window", AuctionIcon],
  ["held", LockIcon],
  ["softClose", ClockIcon],
  ["winner", UnlockIcon],
] as const;

/**
 * The auctions band while no auction is open: how one works, step by step — the rules of
 * packages/payments/src/auction-rules.ts in words (the soft close and the decision window are read from there), never
 * a sample auction. One light runs slowly along the rail; still under prefers-reduced-motion.
 */
export function AuctionsExplainer() {
  const minutes = AUCTION_SOFT_CLOSE_MS / 60_000;
  const hours = AUCTION_DECISION_WINDOW_MS / 3_600_000;
  return (
    <div className="kz-spotlight relative overflow-hidden rounded-3xl border border-border-default bg-surface-1/70 p-6 backdrop-blur-xl sm:p-8">
      <ol className="relative grid gap-7 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        <span aria-hidden className="ae-rail absolute left-5.5 top-5.5 hidden h-px w-[calc(100%-2.75rem)] lg:block" />
        {STEPS.map(([key, Icon], i) => (
          <li key={key} data-reveal style={{ ["--kz-delay" as string]: `${i * 110}ms` }} className="relative flex gap-4 lg:flex-col lg:gap-4">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border-strong bg-surface-2 text-fg-accent shadow-sm">
              <Icon size={20} nodeColor="var(--kz-accent-2)" />
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent font-mono text-[10px] font-bold text-on-accent">
                {i + 1}
              </span>
            </span>
            <span>
              <span className="block text-sm font-bold text-fg">{t(`home.auctionsHow.${key}.title`)}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-fg-secondary">{t(`home.auctionsHow.${key}.body`, { minutes, hours })}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-7 flex flex-col items-start justify-between gap-3 border-t border-border-default pt-5 sm:flex-row sm:items-center">
        <p className="text-sm text-fg-secondary">{t("home.auctionsHow.none")}</p>
        <Link href="/auctions?tab=upcoming" className={cn(buttonVariants({ variant: "secondary", size: "sm", shape: "pill" }), "shrink-0")}>
          {t("home.auctionsHow.upcoming")}
        </Link>
      </div>
      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
  .ae-rail { background: linear-gradient(90deg, transparent, var(--kz-accent) 30%, var(--kz-accent-2) 50%, transparent 70%) 0 0 / 300% 100%, var(--kz-border-default); animation: ae-rail 9s ease-in-out infinite; }
  @keyframes ae-rail { from { background-position: 100% 0, 0 0; } to { background-position: 0% 0, 0 0; } }
  @media (prefers-reduced-motion: reduce) { .ae-rail { animation: none; } }
`;
