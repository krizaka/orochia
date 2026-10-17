"use client";

import Link from "next/link";
import React from "react";

import { CreatorSpaceBanner } from "@/components/creator/CreatorSpaceBanner";
import { StorageMeter } from "@/components/dashboard/StorageMeter";
import { LedgerTable } from "@/components/me/LedgerTable";
import { useMeData } from "@/components/me/MeData";
import { cn, EmptyState, Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { compact, money } from "@/lib/money";

/** « Overview »: the figures that matter first, then the latest movements. Everything else is one click away in the sections. */
export default function MeOverview() {
  const { user } = useAuth();
  const { data, loadError } = useMeData();
  if (!user) return null;
  const isCreator = user.role === "CREATOR";
  const isAdmin = user.role === "ADMIN";
  const spent = isCreator ? 0 : (data?.ledger ?? []).reduce((sum, tx) => sum + tx.amountCents, 0);

  const kpis = data
    ? isCreator
      ? [
          { label: t("dashboard.stats.available"), value: money(user.balanceCents), href: "/me/earnings" },
          { label: t("dashboard.stats.published"), value: String(data.uploads.length), href: "/me/videos" },
          { label: t("dashboard.me.views"), value: compact(data.uploads.reduce((n, v) => n + v.viewsCount, 0)), href: "/me/insights" },
          { label: t("dashboard.stats.pendingPayouts"), value: money(data.pendingPayoutCents), href: "/me/earnings" },
        ]
      : [
          { label: t("dashboard.stats.spent"), value: money(spent), href: "/me/transactions" },
          { label: t("dashboard.stats.unlocked"), value: String(data.library.length), href: "/me/library" },
          { label: t("dashboard.stats.transactions"), value: String(data.ledger.length), href: "/me/transactions" },
        ]
    : [];

  return (
    <div className="space-y-8">
      <CreatorSpaceBanner user={user} />
      {loadError && <EmptyState title={t("dashboard.loadError")} />}
      {!data && !loadError && <Skeleton shape="rect" className="h-48 rounded-2xl" />}
      {data && (
        <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-5", kpis.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
          {kpis.map((k) => (
            <Link key={k.label} href={k.href} className="group block">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">{k.label}</dt>
              <dd className="mt-1 font-mono text-2xl font-black text-fg group-hover:text-fg-accent">{k.value}</dd>
            </Link>
          ))}
        </dl>
      )}
      {(isCreator || isAdmin) && <StorageMeter />}
      {data && (
        <section aria-labelledby="me-recent">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="me-recent" className="text-sm font-bold text-fg">{t("dashboard.me.recent")}</h2>
            <Link href="/me/transactions" className="text-xs font-semibold text-fg-accent hover:underline">{t("dashboard.me.seeAll")}</Link>
          </div>
          {data.ledger.length === 0 ? <p className="text-sm text-fg-secondary">{t("dashboard.me.recentEmpty")}</p> : <LedgerTable lines={data.ledger.slice(0, 5)} isCreator={isCreator} />}
        </section>
      )}
    </div>
  );
}
