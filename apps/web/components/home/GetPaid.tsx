import { AuctionIcon, ChallengeIcon, GlobeIcon, LockIcon, PayoutIcon, Share90Icon, ShieldIcon, TipIcon, UnlockIcon } from "@krizaka/icons";
import { CHALLENGE_SUGGESTED_PLEDGES_CENTS, PAYOUT_MINIMUM_CENTS, splitPlatformFee } from "@orochia/payments";
import Link from "next/link";
import React from "react";

import { BackdropMedia } from "@/components/home/BackdropMedia";
import { SplitIllustration } from "@/components/home/SplitIllustration";
import { buttonVariants, cn, SectionBackdrop } from "@/components/ui";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";
import { SOURCE_URL } from "@/lib/seo";

/**
 * The worked examples, one per way of being paid. The amounts are the product's own defaults — a tip opens at $10
 * (TipModal), a creator's unlock minimum starts at $5 (profiles.min_tip_amount_cents), a pledge of $25 is one of the
 * suggested amounts (challenge-rules) — except the winning bid, an illustration; the split is the platform's
 * (`splitPlatformFee`, PLATFORM_FEE_PERCENTAGE).
 */
const WAYS = [
  ["tips", TipIcon, 10_00],
  ["unlocks", UnlockIcon, 5_00],
  ["auctions", AuctionIcon, 40_00],
  ["challenges", ChallengeIcon, CHALLENGE_SUGGESTED_PLEDGES_CENTS[2]],
] as const;

const PROOFS = [
  ["confirmed", ShieldIcon],
  ["escrow", LockIcon],
  ["payouts", PayoutIcon],
  ["open", GlobeIcon],
] as const;

/**
 * "Get paid" — the creator's side of the home: four ways money comes in (tips, paid unlocks, auctions, challenges),
 * the split drawn as an object (SplitIllustration) and written out, the guarantees that make it trustworthy, and the
 * way in. Every figure is computed from the platform's rules; nothing pretends to be someone's earnings.
 */
export function GetPaid({ fee }: { fee: number }) {
  const share = 100 - fee;
  const example = splitPlatformFee(10_00, fee);
  return (
    <SectionBackdrop
      direction="up"
      grid
      dome={false}
      media={<BackdropMedia clips={["paid"]} />}
      className="orochia-depth"
      aria-labelledby="get-paid"
    >
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div data-reveal className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-1/70 px-3.5 py-1.5 text-xs font-semibold text-fg-accent backdrop-blur-md">
            <Share90Icon size={16} nodeColor="var(--kz-accent-2)" /> {t("home.paid.eyebrow")}
          </p>
          <h2 id="get-paid" className="mt-5 scroll-mt-24 font-display text-3xl font-black leading-tight tracking-tight text-fg sm:text-5xl">
            {t("home.paid.titleLead")} <span className="text-fg-accent">{t("home.paid.titleAccent", { share })}</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-fg-secondary sm:text-lg">{t("home.paid.body")}</p>
        </div>

        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          {/* The split: the object, the two figures, the bar and one sentence that says it with money. */}
          <figure
            data-reveal
            className="relative flex flex-col overflow-hidden rounded-[2rem] border border-border-default bg-surface-1/70 p-6 backdrop-blur-xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-6xl font-black leading-none tracking-tight text-fg-accent sm:text-7xl">{t("home.paid.split.percent", { value: share })}</p>
                <p className="mt-2 text-sm font-semibold text-fg">{t("home.paid.split.you")}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-2xl font-bold leading-none text-fg-secondary">{t("home.paid.split.percent", { value: fee })}</p>
                <p className="mt-2 text-xs font-medium text-fg-muted">{t("home.paid.split.platform")}</p>
              </div>
            </div>
            <SplitIllustration share={share} className="-mx-4 mt-2 w-[calc(100%+2rem)] max-w-none" />
            <div role="img" aria-label={t("home.paid.split.label", { share, fee })} className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
              <span className="h-full rounded-full bg-linear-to-r from-accent to-accent-2" style={{ width: `${share}%` }} />
            </div>
            <figcaption className="mt-4 text-sm leading-relaxed text-fg-secondary">
              {t("home.paid.split.example", { amount: money(10_00), net: money(example.netAmountCents), fee: money(example.platformFeeCents) })}
            </figcaption>
          </figure>

          {/* The four ways in, each with its worked example. */}
          <ul className="grid gap-4 sm:grid-cols-2">
            {WAYS.map(([key, Icon, gross], i) => {
              const split = splitPlatformFee(gross, fee);
              return (
                <li
                  key={key}
                  data-reveal
                  style={{ ["--kz-delay" as string]: `${i * 90}ms` }}
                  className="kz-spotlight kz-lift flex flex-col rounded-3xl border border-border-default bg-surface-1/70 p-5 backdrop-blur-xl sm:p-6"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-fg-accent">
                    <Icon size={22} nodeColor="var(--kz-accent-2)" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-fg">{t(`home.paid.ways.${key}.title`)}</h3>
                  <p className="mt-1 flex-1 text-[13px] leading-relaxed text-fg-secondary">{t(`home.paid.ways.${key}.body`)}</p>
                  <p className="mt-4 flex items-baseline justify-between gap-3 border-t border-border-default pt-3 text-xs">
                    <span className="text-fg-muted">{t(`home.paid.ways.${key}.example`, { amount: money(gross) })}</span>
                    <span className="shrink-0 font-mono font-bold text-fg">{t("home.paid.forYou", { amount: money(split.netAmountCents) })}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Why it can be trusted. */}
        <ul className="mt-6 grid gap-px overflow-hidden rounded-3xl border border-border-default bg-border-default sm:grid-cols-2 lg:grid-cols-4">
          {PROOFS.map(([key, Icon], i) => (
            <li key={key} data-reveal style={{ ["--kz-delay" as string]: `${i * 80}ms` }} className="flex gap-3.5 bg-surface-1/90 p-5 backdrop-blur-xl">
              <Icon size={20} className="mt-0.5 shrink-0 text-fg-accent" nodeColor="var(--kz-accent-2)" />
              <span>
                <span className="block text-sm font-bold text-fg">{t(`home.paid.proofs.${key}.title`, { minimum: money(PAYOUT_MINIMUM_CENTS) })}</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-fg-secondary">
                  {t(`home.paid.proofs.${key}.body`)}
                  {key === "open" && (
                    <>
                      {" "}
                      <a href={SOURCE_URL} target="_blank" rel="noopener" className="font-semibold text-fg-accent underline-offset-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                        {t("home.paid.proofs.open.link")}
                      </a>
                    </>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div data-reveal className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/auth/register"
            className={cn(buttonVariants({ variant: "primary", size: "lg", shape: "pill" }), "kz-sheen w-full gap-2 sm:w-auto")}
          >
            <PayoutIcon size={18} /> {t("home.paid.cta")}
          </Link>
          <Link href="/challenges" className={cn(buttonVariants({ variant: "outline", size: "lg", shape: "pill" }), "w-full gap-2 bg-surface-1/60 backdrop-blur-md sm:w-auto")}>
            {t("home.paid.ctaChallenges")}
          </Link>
        </div>
      </div>
    </SectionBackdrop>
  );
}
