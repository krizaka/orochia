import { AuctionIcon, ChallengeIcon, CheckIcon, CreatorIcon, ForwardIcon, TipIcon, UnlockIcon } from "@krizaka/icons";
import Link from "next/link";
import React from "react";

import { BackdropMedia } from "@/components/home/BackdropMedia";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { buttonVariants, cn, RotatingWord, SectionBackdrop } from "@/components/ui";
import { t } from "@/lib/i18n";

const WAYS = [
  ["tip", TipIcon],
  ["unlock", UnlockIcon],
  ["auction", AuctionIcon],
  ["challenge", ChallengeIcon],
] as const;

/**
 * The visitor's hero: the promise, the four ways to support a creator (each a door to the "Get paid" section, `/#get-paid`),
 * the way in, and the phone that plays the real flows. Behind it, three panes of licensed footage out of focus at
 * different depths (BackdropMedia), the brand's dome and a perspective floor (SectionBackdrop).
 */
export function HomeHero({ share, stats }: { share: number; stats: { videos: number; creators: number } }) {
  return (
    <SectionBackdrop
      direction="down"
      grid
      media={<BackdropMedia layout="panes" eager clips={["hero", "fans", "creators"]} />}
      className="orochia-depth"
      aria-labelledby="home-hero-title"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8 lg:pb-24 lg:pt-20">
        <div className="min-w-0 max-w-[36rem]">
          <p className="inline-flex items-center gap-2 rounded-full border border-border-default bg-surface-1/70 px-3.5 py-1.5 text-xs font-semibold text-fg-accent backdrop-blur-md">
            <CreatorIcon size={16} nodeColor="var(--kz-accent-2)" /> {t("home.eyebrow")}
          </p>
          <h1
            id="home-hero-title"
            aria-label={`${t("home.titleLead")} ${t("home.rotating.a")}`}
            className="mt-6 font-display text-[2.5rem] font-black leading-[1.03] tracking-tight text-balance text-fg sm:text-6xl lg:text-[3.7rem]"
          >
            <span aria-hidden>{t("home.titleLead")}</span>
            <span aria-hidden className="block">
              <RotatingWord words={[t("home.rotating.a"), t("home.rotating.b"), t("home.rotating.c"), t("home.rotating.d")]} className="pr-1 text-fg-accent" />
            </span>
          </h1>
          <p className="mt-6 text-base leading-relaxed text-fg-secondary sm:text-lg">{t("home.body", { share })}</p>

          <div className="mt-7">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">{t("home.ways.title")}</p>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {WAYS.map(([key, Icon]) => (
                <li key={key}>
                  <Link
                    href="/#get-paid"
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1/70 px-3 py-1.5 text-xs font-semibold text-fg backdrop-blur-md transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon size={15} className="text-fg-accent" nodeColor="var(--kz-accent-2)" /> {t(`home.ways.${key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth/register" className={cn(buttonVariants({ variant: "primary", size: "lg", shape: "pill" }), "kz-sheen gap-2 shadow-lg")}>
              {t("home.ctaJoin")}
            </Link>
            <Link href="/explore" className={cn(buttonVariants({ variant: "outline", size: "lg", shape: "pill" }), "gap-2 bg-surface-1/60 backdrop-blur-md")}>
              {t("home.ctaExplore")} <ForwardIcon size={18} />
            </Link>
          </div>

          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-fg-secondary">
            {[t("home.trust.free"), t("home.trust.private"), t("home.trust.share", { share })].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckIcon size={14} className="text-success" /> {item}
              </li>
            ))}
          </ul>
          {stats.videos > 0 && (
            <p className="mt-4 font-mono text-[11px] text-fg-secondary">
              {t("home.stats", { videos: stats.videos.toLocaleString("en-US"), creators: stats.creators.toLocaleString("en-US") })}
            </p>
          )}
        </div>
        <div className="hero-fade flex min-w-0 justify-center [animation-delay:300ms] lg:pr-4">
          <ProductShowcase share={share} />
        </div>
      </div>
      <style>{STYLES}</style>
    </SectionBackdrop>
  );
}

const STYLES = `
        .hero-fade { animation: hero-fade 0.8s var(--kz-ease) both; }
        @keyframes hero-fade { from { opacity: 0; transform: translateY(16px); } }
        @media (prefers-reduced-motion: reduce) { .hero-fade { animation: none; } }
      `;
