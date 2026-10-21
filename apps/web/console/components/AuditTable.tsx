"use client";

import { Badge } from "@krizaka/ui/badge";
import { type Outcome, areaOf } from "@/console/lib/audit-outcome";
import { DataTable, type DataTableColumn,DataTableColumnsMenu, DataTableExport, DataTableFilters } from "@krizaka/ui/data-table";

export interface AuditRow {
  id: string;
  at: string;
  action: string;
  target: string | null;
  outcome: Outcome;
  detail: string | null;
  actor: string | null;
  requestId: string | null;
}

const TONE = { ok: "success", refused: "warning", failed: "danger" } as const;

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });

const columns: DataTableColumn<AuditRow>[] = [
  { id: "at", header: "When", sortable: true, value: (r) => r.at, cell: (r) => <span className="whitespace-nowrap font-mono text-xs">{when(r.at)}</span> },
  { id: "actor", header: "Who", filter: "facet", value: (r) => r.actor ?? "—", cell: (r) => <span className="text-xs">{r.actor ?? "—"}</span> },
  { id: "action", header: "Action", sortable: true, filter: "facet", card: "title" },
  { id: "target", header: "Target", filter: "text", value: (r) => r.target ?? "", cell: (r) => <span className="font-mono text-[11px]">{r.target ?? "—"}</span> },
  { id: "area", header: "Area", filter: "facet", value: (r) => areaOf(r.action), cell: (r) => <span className="text-xs">{areaOf(r.action)}</span> },
  { id: "outcome", header: "Outcome", filter: "facet", value: (r) => r.outcome, cell: (r) => <Badge tone={TONE[r.outcome]}>{r.outcome}</Badge> },
  { id: "request", header: "Request", value: (r) => r.requestId ?? "", cell: (r) => <span className="font-mono text-[11px]">{r.requestId ?? "—"}</span> },
  { id: "detail", header: "Detail", value: (r) => r.detail ?? "", cell: (r) => <span className="text-xs text-fg-secondary">{r.detail ?? ""}</span> },
];

/** The operator log: every decision and sign-in, sortable, filterable by area, action and outcome (the Tasks view opens it on one), exportable. */
export function AuditTable({ rows, outcome }: { rows: AuditRow[]; outcome?: Outcome }) {
  return (
    <DataTable
      caption="Operator log"
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      defaultSort={{ column: "at", direction: "descending" }}
      defaultPageSize={25}
      defaultFilters={outcome ? { outcome: [outcome] } : undefined}
      toolbar={
        <div className="flex flex-col gap-3">
          <DataTableFilters />
          <div className="flex justify-end gap-2">
            <DataTableColumnsMenu />
            <DataTableExport filename="orochia-operator-log.csv" />
          </div>
        </div>
      }
    />
  );
}
