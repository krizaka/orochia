"use client";

import React from "react";

import { cn, EmptyState } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

import type { LedgerLine } from "./MeData";


export function LedgerTable({ lines, isCreator }: { lines: LedgerLine[]; isCreator: boolean }) {
  const { t, money, date } = useI18n();
  if (lines.length === 0) return <EmptyState title={t("dashboard.ledger.empty")} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="py-2 pr-4">{t("dashboard.ledger.date")}</th>
            <th className="py-2 pr-4">{t("dashboard.ledger.type")}</th>
            <th className="py-2 pr-4">{isCreator ? t("dashboard.ledger.from") : t("dashboard.ledger.creator")}</th>
            <th className="py-2 pr-4">{t("dashboard.ledger.gateway")}</th>
            <th className="py-2 text-right">{t("dashboard.ledger.amount")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {lines.map((tx) => (
            <tr key={tx.id} className="text-fg-secondary">
              <td className="py-2.5 pr-4 font-mono">{date(tx.createdAt)}</td>
              <td className="py-2.5 pr-4">{tx.entryType.replace(/_/g, " ").toLowerCase()}</td>
              <td className="py-2.5 pr-4">{tx.counterparty}</td>
              <td className="py-2.5 pr-4">{tx.gateway}</td>
              <td className={cn("py-2.5 text-right font-mono font-bold", tx.amountCents < 0 ? "text-fg-danger" : "text-fg-success")}>{money(tx.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
