import { Gavel, ShieldCheck, Timer, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import React from "react";

import { AuctionCard } from "@/components/auctions/AuctionCard";
import { buttonVariants, cn,orochiaButton } from "@/components/ui";
import { UrlTabs } from "@/components/UrlTabs";
import { AUCTION_TABS, type AuctionTab,listAuctions } from "@/lib/auctions";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { pageAlternates } from "@/lib/seo-i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
  title: t("auctions.metaTitle"),
  description: t("auctions.metaDescription"),
  alternates: await pageAlternates("/auctions"),
};
}

/** Auctions: open (ending soonest first), upcoming, sold, and — signed in — yours as a bidder and as a seller. */
export default async function AuctionsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const { t } = await getI18n();
  const { tab: asked } = await props.searchParams;
  const user = await getCurrentUser();
  const tabs = AUCTION_TABS.filter((id) => (id === "bidding" ? Boolean(user) : id === "selling" ? user?.role === "CREATOR" : true));
  const tab: AuctionTab = (tabs as readonly string[]).includes(asked ?? "") ? (asked as AuctionTab) : "open";
  const items = await listAuctions(tab, user?.id ?? null, 24, user?.isAgeVerified === true);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end" data-reveal>
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-fg-accent">
            <Gavel className="h-3.5 w-3.5" /> {t("auctions.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-2xl font-black text-fg sm:text-3xl">{t("auctions.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-fg-secondary">{t("auctions.subtitle")}</p>
        </div>
        <ol className="grid gap-2 text-xs text-fg-secondary sm:grid-cols-3 lg:w-[34rem]">
          {[
            { icon: ShieldCheck, key: "held" },
            { icon: Timer, key: "softClose" },
            { icon: Trophy, key: "win" },
          ].map(({ icon: Icon, key }, i) => (
            <li key={key} data-reveal style={{ "--kz-delay": `${i * 70}ms` } as React.CSSProperties} className="flex items-start gap-2 rounded-2xl border border-border-default bg-surface-2 p-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fg-accent" aria-hidden />
              <span>{t(`auctions.steps.${key}` as "auctions.steps.held")}</span>
            </li>
          ))}
        </ol>
      </header>

      <UrlTabs label={t("auctions.tabsLabel")} path="/auctions" defaultId="open" active={tab} tabs={tabs.map((id) => ({ id, label: t(`auctions.tabs.${id}`) }))}>
  
        {items.length === 0 ? (
          <div className="kz-fade rounded-3xl border border-dashed border-border-default px-6 py-16 text-center">
            <Gavel className="mx-auto h-8 w-8 text-fg-accent/70" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-fg">{t(`auctions.empty.${tab}.title`)}</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-fg-secondary">{t(`auctions.empty.${tab}.body`)}</p>
            {tab === "selling" && (
              <Link href="/me/videos" className={orochiaButton({ variant: "sensual", shape: "pill", className: "mt-5" })}>
                {t("auctions.empty.selling.cta")}
              </Link>
            )}
            {tab !== "open" && tab !== "selling" && (
              <Link href="/auctions" className={buttonVariants({ variant: "secondary", shape: "pill", className: "mt-5" })}>
                {t("auctions.seeOpen")}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((a, i) => (
              <AuctionCard key={a.id} auction={a} index={i} />
            ))}
          </div>
        )}
      </UrlTabs>
    </div>
  );
}
