import { db, payoutRequests, profiles, tipsLedger, users, videoViews, videos } from "@orochia/db";
import { and, desc, eq, gte, isNull, ne, sql } from "drizzle-orm";
import { getCreatorAvailableBalanceCents, platformFeePercent } from "@orochia/payments";
import { withSignedMedia } from "./media-urls";

/**
 * A creator's earnings, read from the ledger (the only source of money truth): totals for a period, cumulative views,
 * what each video brings in (best and weakest), the month-by-month trend, every transaction, and the payouts. The same
 * read model feeds the Earnings page and the CSV exports.
 */

export const PERIODS = ["30d", "90d", "12m", "all"] as const;
export type Period = (typeof PERIODS)[number];

export function periodStart(period: Period, now = new Date()): Date | null {
  const d = new Date(now);
  if (period === "30d") d.setUTCDate(d.getUTCDate() - 30);
  else if (period === "90d") d.setUTCDate(d.getUTCDate() - 90);
  else if (period === "12m") d.setUTCMonth(d.getUTCMonth() - 12);
  else return null;
  return d;
}

const credits = (creatorId: string, since: Date | null) =>
  and(eq(tipsLedger.creatorId, creatorId), eq(tipsLedger.entryType, "CREATOR_CREDIT"), since ? gte(tipsLedger.createdAt, since) : undefined);

export interface EarningsSummary {
  grossCents: number;
  feeCents: number;
  netCents: number;
  payments: number;
  supporters: number;
  periodViews: number;
  totalViews: number;
  availableCents: number;
  pendingPayoutCents: number;
  paidOutCents: number;
  feePercent: number;
}

export async function earningsSummary(creatorId: string, period: Period): Promise<EarningsSummary> {
  const since = periodStart(period);
  const [money] = await db
    .select({
      gross: sql<string>`coalesce(sum(${tipsLedger.grossAmountCents}), 0)`,
      fee: sql<string>`coalesce(sum(${tipsLedger.platformFeeCents}), 0)`,
      net: sql<string>`coalesce(sum(${tipsLedger.netAmountCents}), 0)`,
      payments: sql<string>`count(*)`,
      supporters: sql<string>`count(distinct ${tipsLedger.senderId})`,
    })
    .from(tipsLedger)
    .where(credits(creatorId, since));
  const [views] = await db
    .select({ total: sql<string>`coalesce(sum(${videos.viewsCount}), 0)` })
    .from(videos)
    .where(and(eq(videos.creatorId, creatorId), isNull(videos.removedAt)));
  const [periodViews] = await db
    .select({ n: sql<string>`count(*)` })
    .from(videoViews)
    .innerJoin(videos, eq(videos.id, videoViews.videoId))
    .where(and(eq(videos.creatorId, creatorId), since ? gte(videoViews.createdAt, since) : undefined));
  const [payouts] = await db
    .select({
      pending: sql<string>`coalesce(sum(${payoutRequests.amountCents}) filter (where ${payoutRequests.status} in ('REQUESTED', 'UNDER_REVIEW', 'PROCESSING')), 0)`,
      paid: sql<string>`coalesce(sum(${payoutRequests.amountCents}) filter (where ${payoutRequests.status} = 'SETTLED'), 0)`,
    })
    .from(payoutRequests)
    .where(and(eq(payoutRequests.creatorId, creatorId), ne(payoutRequests.status, "FAILED")));
  return {
    grossCents: Number(money?.gross ?? 0),
    feeCents: Number(money?.fee ?? 0),
    netCents: Number(money?.net ?? 0),
    payments: Number(money?.payments ?? 0),
    supporters: Number(money?.supporters ?? 0),
    periodViews: Number(periodViews?.n ?? 0),
    totalViews: Number(views?.total ?? 0),
    availableCents: await getCreatorAvailableBalanceCents(creatorId),
    pendingPayoutCents: Number(payouts?.pending ?? 0),
    paidOutCents: Number(payouts?.paid ?? 0),
    feePercent: platformFeePercent(),
  };
}

export interface VideoEarnings {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  totalViews: number;
  likes: number;
  payments: number;
  netCents: number;
  grossCents: number;
}

/** Every video of the creator with what it brought in over the period (videos that earned nothing included). */
export async function videoEarnings(creatorId: string, period: Period): Promise<VideoEarnings[]> {
  const since = periodStart(period);
  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      thumbnailUrl: videos.thumbnailUrl,
      createdAt: videos.createdAt,
      totalViews: videos.viewsCount,
      likes: videos.likesCount,
      payments: sql<string>`count(${tipsLedger.id})`,
      netCents: sql<string>`coalesce(sum(${tipsLedger.netAmountCents}), 0)`,
      grossCents: sql<string>`coalesce(sum(${tipsLedger.grossAmountCents}), 0)`,
    })
    .from(videos)
    .leftJoin(
      tipsLedger,
      and(eq(tipsLedger.videoId, videos.id), eq(tipsLedger.entryType, "CREATOR_CREDIT"), since ? gte(tipsLedger.createdAt, since) : undefined),
    )
    .where(and(eq(videos.creatorId, creatorId), isNull(videos.removedAt)))
    .groupBy(videos.id)
    .orderBy(desc(sql`coalesce(sum(${tipsLedger.netAmountCents}), 0)`), desc(videos.viewsCount));
  return rows.map((r) => withSignedMedia({ ...r, payments: Number(r.payments), netCents: Number(r.netCents), grossCents: Number(r.grossCents) }));
}

/** Net earnings per month over the last 12 months (empty months included). */
export async function monthlyNet(creatorId: string, now = new Date()): Promise<{ month: string; netCents: number }[]> {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const rows = await db
    .select({ month: sql<string>`to_char(date_trunc('month', ${tipsLedger.createdAt} at time zone 'UTC'), 'YYYY-MM')`, net: sql<string>`sum(${tipsLedger.netAmountCents})` })
    .from(tipsLedger)
    .where(credits(creatorId, from))
    .groupBy(sql`1`);
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.net)]));
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1));
    const month = d.toISOString().slice(0, 7);
    return { month, netCents: byMonth.get(month) ?? 0 };
  });
}

export interface EarningLine {
  id: string;
  createdAt: Date;
  kind: "unlock" | "tip";
  videoTitle: string | null;
  supporter: string | null;
  grossCents: number;
  feeCents: number;
  netCents: number;
  gateway: string;
}

/** Every payment received over the period, newest first (`limit` for the page; none for exports). */
export async function earningLines(creatorId: string, period: Period, limit?: number): Promise<EarningLine[]> {
  const since = periodStart(period);
  const query = db
    .select({
      id: tipsLedger.id,
      createdAt: tipsLedger.createdAt,
      note: tipsLedger.note,
      videoTitle: videos.title,
      supporter: users.username,
      supporterName: profiles.displayName,
      grossCents: tipsLedger.grossAmountCents,
      feeCents: tipsLedger.platformFeeCents,
      netCents: tipsLedger.netAmountCents,
      gateway: tipsLedger.gateway,
    })
    .from(tipsLedger)
    .leftJoin(videos, eq(videos.id, tipsLedger.videoId))
    .leftJoin(users, eq(users.id, tipsLedger.senderId))
    .leftJoin(profiles, eq(profiles.userId, tipsLedger.senderId))
    .where(credits(creatorId, since))
    .orderBy(desc(tipsLedger.createdAt));
  const rows = limit ? await query.limit(limit) : await query;
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    kind: /unlock/i.test(r.note ?? "") ? "unlock" : "tip",
    videoTitle: r.videoTitle,
    supporter: r.supporter ? `@${r.supporter}` : null,
    grossCents: r.grossCents,
    feeCents: r.feeCents,
    netCents: r.netCents,
    gateway: r.gateway,
  }));
}

export async function payoutHistory(creatorId: string) {
  return db
    .select({ id: payoutRequests.id, amountCents: payoutRequests.amountCents, status: payoutRequests.status, method: payoutRequests.payoutMethod, createdAt: payoutRequests.createdAt, settledAt: payoutRequests.settledAt, reference: payoutRequests.txHashOrReference })
    .from(payoutRequests)
    .where(eq(payoutRequests.creatorId, creatorId))
    .orderBy(desc(payoutRequests.createdAt))
    .limit(50);
}

// ── CSV ─────────────────────────────────────────────────────────────────────────────────────────

const cell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : v === null || v === undefined ? "" : String(v);
  // Quote, and neutralise spreadsheet formulas (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const usd = (cents: number) => (cents / 100).toFixed(2);

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export const transactionsCsv = (lines: EarningLine[]) =>
  toCsv(
    ["date_utc", "type", "video", "supporter", "gross_usd", "platform_fee_usd", "net_usd", "payment_method", "transaction_id"],
    lines.map((l) => [l.createdAt, l.kind, l.videoTitle, l.supporter, usd(l.grossCents), usd(l.feeCents), usd(l.netCents), l.gateway, l.id]),
  );

export const videosCsv = (rows: VideoEarnings[]) =>
  toCsv(
    ["video", "published_utc", "total_views", "likes", "payments", "gross_usd", "net_usd", "video_id"],
    rows.map((v) => [v.title, v.createdAt, v.totalViews, v.likes, v.payments, usd(v.grossCents), usd(v.netCents), v.id]),
  );
