"use client";

import { Badge } from "@krizaka/ui/badge";
import { DataTable, type DataTableColumn,DataTableColumnsMenu, DataTableExport, DataTableFilters } from "@krizaka/ui/data-table";

export interface AuditRow {
  id: string;
  at: string;
  action: string;
  target: string | null;
  ok: boolean;
  detail: string | null;
  actor: string | null;
  requestId: string | null;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" });

const columns: DataTableColumn<AuditRow>[] = [
  { id: "at", header: "When", sortable: true, value: (r) => r.at, cell: (r) => <span className="whitespace-nowrap font-mono text-xs">{when(r.at)}</span> },
  { id: "actor", header: "Who", filter: "facet", value: (r) => r.actor ?? "—", cell: (r) => <span className="text-xs">{r.actor ?? "—"}</span> },
  { id: "action", header: "Action", sortable: true, filter: "facet", card: "title" },
  { id: "target", header: "Target", filter: "text", value: (r) => r.target ?? "", cell: (r) => <span className="font-mono text-[11px]">{r.target ?? "—"}</span> },
  { id: "outcome", header: "Outcome", filter: "facet", value: (r) => (r.ok ? "done" : "refused"), cell: (r) => <Badge tone={r.ok ? "success" : "danger"}>{r.ok ? "done" : "refused"}</Badge> },
  { id: "request", header: "Request", value: (r) => r.requestId ?? "", cell: (r) => <span className="font-mono text-[11px]">{r.requestId ?? "—"}</span> },
  { id: "detail", header: "Detail", value: (r) => r.detail ?? "", cell: (r) => <span className="text-xs text-fg-secondary">{r.detail ?? ""}</span> },
];

/** The operator log: every decision and sign-in, sortable, filterable by action and outcome, exportable. */
export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return (
    <DataTable
      caption="Operator log"
      rows={rows}
      columns={columns}
      getRowId={(r) => r.id}
      defaultSort={{ column: "at", direction: "descending" }}
      defaultPageSize={25}
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
