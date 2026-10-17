"use client";

import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

import { useMeData } from "@/components/me/MeData";
import { EmptyState } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n-client";

export default function MeTreasury() {
  const { t, money } = useI18n();
  const { user } = useAuth();
  const { treasury } = useMeData();
  const router = useRouter();
  const isAdmin = user?.role === "ADMIN";
  useEffect(() => {
    if (user && !isAdmin) router.replace("/me");
  }, [user, isAdmin, router]);
  if (!isAdmin) return null;
  if (!treasury) return <EmptyState title={t("dashboard.treasury.unavailable")} />;
  const cells = [
    [t("dashboard.treasury.gross"), money(treasury.grossCents), t("dashboard.treasury.grossHint", { count: treasury.creditsCount })],
    [t("dashboard.treasury.fees"), money(treasury.platformFeeCents), t("dashboard.treasury.feesHint", { percent: treasury.protocolRakePercent })],
    [t("dashboard.treasury.creators"), money(treasury.creatorNetCents), t("dashboard.treasury.creatorsHint")],
    [t("dashboard.treasury.requested"), money(treasury.payoutsRequestedCents), t("dashboard.treasury.requestedHint")],
    [t("dashboard.treasury.settled"), money(treasury.payoutsSettledCents), t("dashboard.treasury.settledHint")],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
      {cells.map(([label, value, hint]) => (
        <div key={label}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">{label}</dt>
          <dd className="mt-1 font-mono text-2xl font-black text-fg-success">{value}</dd>
          <span className="text-[11px] text-fg-muted">{hint}</span>
        </div>
      ))}
    </dl>
  );
}
