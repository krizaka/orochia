import React from "react";
import Link from "next/link";
import { Gavel, ShieldCheck, Timer, Trophy } from "lucide-react";
import { AuctionCard } from "@/components/auctions/AuctionCard";
import { buttonClass, cx } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { AUCTION_TABS, listAuctions, type AuctionTab } from "@/lib/auctions";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: t("auctions.metaTitle"),
  description: t("auctions.metaDescription"),
  alternates: { canonical: "/auctions" },
};

/** Auctions: live (ending soonest first), upcoming, sold, and — signed in — yours as a bidder and as a seller. */
export default async function AuctionsPage(props: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: asked } = await props.searchParams;
  const user = await getCurrentUser();
  const tabs = AUCTION_TABS.filter((id) => (id === "bidding" ? Boolean(user) : id === "selling" ? user?.role === "CREATOR" : true));
  const tab: AuctionTab = (tabs as readonly string[]).includes(asked ?? "") ? (asked as AuctionTab) : "live";
  const items = await listAuctions(tab, user?.id ?? null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end" data-reveal>
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-fuchsia-300 light:text-fuchsia-700">
            <Gavel className="h-3.5 w-3.5" /> {t("auctions.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-2xl font-black text-white sm:text-3xl light:text-slate-900">{t("auctions.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400 light:text-slate-600">{t("auctions.subtitle")}</p>
        </div>
        <ol className="grid gap-2 text-xs text-zinc-300 sm:grid-cols-3 lg:w-[34rem] light:text-slate-700">
          {[
            { icon: ShieldCheck, key: "held" },
            { icon: Timer, key: "softClose" },
            { icon: Trophy, key: "win" },
          ].map(({ icon: Icon, key }, i) => (
            <li key={key} data-reveal style={{ "--kz-delay": `${i * 70}ms` } as React.CSSProperties} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 light:border-black/5 light:bg-white">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-400 light:text-fuchsia-600" aria-hidden />
              <span>{t(`auctions.steps.${key}` as "auctions.steps.held")}</span>
            </li>
          ))}
        </ol>
      </header>

      <nav aria-label={t("auctions.tabsLabel")} className="mb-6 flex gap-1 overflow-x-auto border-b border-white/10 light:border-black/10">
        {tabs.map((id) => (
          <Link
            key={id}
            href={id === "live" ? "/auctions" : `/auctions?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cx(
              "-mb-px shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400",
              tab === id ? "border-fuchsia-500 text-white light:text-slate-900" : "border-transparent text-zinc-400 hover:text-white light:text-slate-500 hover:light:text-slate-900",
            )}
          >
            {t(`auctions.tabs.${id}`)}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="kz-fade rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center light:border-black/10">
          <Gavel className="mx-auto h-8 w-8 text-fuchsia-400/70" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-white light:text-slate-900">{t(`auctions.empty.${tab}.title`)}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-zinc-400 light:text-slate-500">{t(`auctions.empty.${tab}.body`)}</p>
          {tab === "selling" && (
            <Link href="/dashboard?tab=uploads" className={buttonClass({ variant: "primary", className: "mt-5" })}>
              {t("auctions.empty.selling.cta")}
            </Link>
          )}
          {tab !== "live" && tab !== "selling" && (
            <Link href="/auctions" className={buttonClass({ variant: "secondary", className: "mt-5" })}>
              {t("auctions.seeLive")}
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
    </div>
  );
}
