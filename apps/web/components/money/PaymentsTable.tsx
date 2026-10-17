"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";

import { Badge, DataTable, EmptyState, Pagination } from "@/components/ui";
import type { EarningKind } from "@/lib/earning-kinds";
import { useI18n } from "@/lib/i18n-client";

export interface PaymentLine {
  id: string;
  createdAt: string;
  kind: EarningKind;
  videoTitle: string | null;
  supporter: string | null;
  netCents: number;
}

const PAGE_SIZE = 10;
const SORTABLE = ["createdAt", "kind", "netCents"] as const;
type Column = (typeof SORTABLE)[number];


/**
 * The payments a creator received, on @krizaka/ui's `DataTable` (sortable columns, cards on a phone) and `Pagination`.
 * The sort and the page are the address (`?txsort=netCents-desc&txpage=2`), like every view of the app.
 */
export function PaymentsTable({ lines }: { lines: PaymentLine[] }) {
  const { t, money, date } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [column, direction] = (params.get("txsort") ?? "").split("-");
  const sort = (SORTABLE as readonly string[]).includes(column) ? { column, direction: direction === "asc" ? ("ascending" as const) : ("descending" as const) } : null;
  const pageCount = Math.max(1, Math.ceil(lines.length / PAGE_SIZE));
  const page = Math.min(pageCount, Math.max(1, Number(params.get("txpage")) || 1));

  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    return `${pathname}${next.size ? `?${next}` : ""}`;
  };

  const sorted = sort
    ? [...lines].sort((a, b) => {
        const key = sort.column as Column;
        const order = a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0;
        return sort.direction === "ascending" ? order : -order;
      })
    : lines;
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const first = (page - 1) * PAGE_SIZE + 1;

  return (
    <DataTable
      caption={t("earnings.transactions")}
      rows={rows}
      getRowId={(l) => l.id}
      manual={{ sorting: true }}
      sort={sort}
      onSortChange={(s) => router.replace(href({ txsort: s ? `${s.column}-${s.direction === "ascending" ? "asc" : "desc"}` : null, txpage: null }), { scroll: false })}
      density="compact"
      empty={<EmptyState bird="flamingo" title={t("earnings.noTransactions")} className="border-0" />}
      columns={[
        { id: "createdAt", header: t("earnings.cols.date"), sortable: true, cell: (l) => <span className="whitespace-nowrap text-xs text-fg-muted">{date(l.createdAt)}</span> },
        {
          id: "kind",
          header: t("earnings.cols.kind"),
          sortable: true,
          cell: (l) => (
            <Badge tone="accent" className="normal-case tracking-normal">
              {t(`earnings.kinds.${l.kind}`)}
            </Badge>
          ),
        },
        { id: "videoTitle", header: t("earnings.cols.video"), card: "title", cell: (l) => <span className="text-fg">{l.videoTitle ?? "—"}</span> },
        { id: "supporter", header: t("earnings.cols.supporter"), cell: (l) => <span className="text-xs text-fg-secondary">{l.supporter ?? ""}</span> },
        {
          id: "netCents",
          header: t("earnings.cols.net"),
          sortable: true,
          align: "end",
          cell: (l) => <span className="whitespace-nowrap font-mono font-semibold tabular-nums text-fg-success">+{money(l.netCents)}</span>,
        },
      ]}
      footer={
        lines.length > PAGE_SIZE ? (
          <Pagination
            page={page}
            pageCount={pageCount}
            getHref={(p) => href({ txpage: p === 1 ? null : String(p) })}
            status={t("earnings.shown", { from: first, to: Math.min(first + PAGE_SIZE - 1, lines.length), total: lines.length })}
          />
        ) : undefined
      }
    />
  );
}
