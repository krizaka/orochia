import { complianceReports, db, tipsLedger } from "@orochia/db";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * The operator's trends over the last 12 months (empty months included), for the console's charts: what the platform
 * processed and kept (from the ledger's creator credits — gross, fee, the creators' net) and the content reports opened
 * and resolved. Read models only; the console draws them.
 */
export interface AdminMonth {
  month: string;
  grossCents: number;
  feeCents: number;
  netCents: number;
  payments: number;
  reportsOpened: number;
  reportsResolved: number;
}

const monthOf = (column: unknown) => sql<string>`to_char(date_trunc('month', ${column} at time zone 'UTC'), 'YYYY-MM')`;

export async function adminTrends(now = new Date()): Promise<AdminMonth[]> {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const [money, opened, resolved] = await Promise.all([
    db
      .select({
        month: monthOf(tipsLedger.createdAt),
        gross: sql<string>`coalesce(sum(${tipsLedger.grossAmountCents}), 0)`,
        fee: sql<string>`coalesce(sum(${tipsLedger.platformFeeCents}), 0)`,
        net: sql<string>`coalesce(sum(${tipsLedger.netAmountCents}), 0)`,
        payments: sql<string>`count(*)`,
      })
      .from(tipsLedger)
      .where(and(eq(tipsLedger.entryType, "CREATOR_CREDIT"), gte(tipsLedger.createdAt, from)))
      .groupBy(sql`1`),
    db
      .select({ month: monthOf(complianceReports.createdAt), n: sql<string>`count(*)` })
      .from(complianceReports)
      .where(gte(complianceReports.createdAt, from))
      .groupBy(sql`1`),
    db
      .select({ month: monthOf(complianceReports.resolvedAt), n: sql<string>`count(*)` })
      .from(complianceReports)
      .where(gte(complianceReports.resolvedAt, from))
      .groupBy(sql`1`),
  ]);
  const byMonth = <T extends { month: string }>(rows: T[]) => new Map(rows.map((r) => [r.month, r]));
  const m = byMonth(money);
  const o = byMonth(opened);
  const r = byMonth(resolved);
  return Array.from({ length: 12 }, (_, i) => {
    const month = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
    const row = m.get(month);
    return {
      month,
      grossCents: Number(row?.gross ?? 0),
      feeCents: Number(row?.fee ?? 0),
      netCents: Number(row?.net ?? 0),
      payments: Number(row?.payments ?? 0),
      reportsOpened: Number(o.get(month)?.n ?? 0),
      reportsResolved: Number(r.get(month)?.n ?? 0),
    };
  });
}
