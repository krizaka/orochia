import React from "react";
import Link from "next/link";
import { Clock, Gavel, Lock, Trophy } from "lucide-react";
import { buttonVariants, cn } from "@/components/ui";
import { t } from "@/lib/i18n";

const STEPS = [
  ["window", Gavel, "from-accent to-accent-2"],
  ["held", Lock, "from-accent-2 to-accent-2"],
  ["softClose", Clock, "from-warning to-orange-500"],
  ["winner", Trophy, "from-success to-teal-500"],
] as const;

/**
 * The home's auctions band while no auction is open: how one works, step by step — the rules of
 * packages/payments/src/auction-rules.ts in words, never a sample auction. A light runs along the steps; it stops under
 * prefers-reduced-motion.
 */
export function AuctionsExplainer() {
  return (
    <div className="kz-spotlight relative overflow-hidden rounded-3xl border border-border-default bg-surface-2/40 p-6 sm:p-8">
      <ol className="relative grid gap-6 sm:grid-cols-4 sm:gap-4">
        <span
          aria-hidden
          className="ae-rail absolute left-5 top-5 hidden h-px w-[calc(100%-2.5rem)] bg-linear-to-r from-accent/0 via-accent-2/60 to-success/0 sm:block"
        />
        {STEPS.map(([key, Icon, tone], i) => (
          <li key={key} data-reveal style={{ ["--kz-delay" as string]: `${i * 110}ms` }} className="relative flex gap-4 sm:flex-col sm:gap-3">
            <span
              className={cn(
                "ae-dot relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br",
                tone,
                "text-white shadow-lg"
              )}
              style={{ animationDelay: `${i * 0.9}s` }}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold text-fg">{t(`home.auctionsHow.${key}.title`)}</span>
              <span className="mt-1 block text-xs leading-relaxed text-fg-secondary">{t(`home.auctionsHow.${key}.body`)}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-border-default pt-5 sm:flex-row sm:items-center">
        <p className="text-sm text-fg-secondary">{t("home.auctionsHow.none")}</p>
        <Link href="/auctions?tab=upcoming" className={buttonVariants({ variant: "secondary", size: "sm", shape: "pill" })}>
          {t("home.auctionsHow.upcoming")}
        </Link>
      </div>
      <style>{STYLES}</style>
    </div>
  );
}

const STYLES = `
        .ae-dot::after { content: ""; position: absolute; inset: -4px; border-radius: 1.1rem; border: 1px solid rgb(232 121 249 / .5); opacity: 0; animation: ae-ring 3.6s ease-out infinite; animation-delay: inherit; }
        @keyframes ae-ring { 0% { opacity: .9; transform: scale(.9); } 40%, 100% { opacity: 0; transform: scale(1.35); } }
        .ae-rail { background-size: 200% 100%; animation: ae-rail 3.6s linear infinite; }
        @keyframes ae-rail { from { background-position: 100% 0; } to { background-position: -100% 0; } }
        @media (prefers-reduced-motion: reduce) { .ae-dot::after, .ae-rail { animation: none; } }
`;
