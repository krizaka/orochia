"use client";

import { Gauge } from "@krizaka/charts/gauge";
import { AreaChart } from "@krizaka/charts/line";
import { Sparkline } from "@krizaka/charts/sparkline";
import { Download, Eye, Film, Landmark, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useState } from "react";

import { PaymentsTable } from "@/components/money/PaymentsTable";
import { PayoutAccountSheet } from "@/components/money/PayoutAccountSheet";
import { WithdrawSheet } from "@/components/money/WithdrawSheet";
import { Badge, type BadgeProps, Button, buttonVariants, Chip, cn, EmptyState, Loader, Meter, MoneyTicker, NumberTicker, orochiaButton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { EARNING_KINDS, type EarningKind } from "@/lib/earning-kinds";
import { t } from "@/lib/i18n";
import { compact, money } from "@/lib/money";

type Period = "30d" | "90d" | "12m" | "all";
type Sort = "net" | "views";
interface Earnings {
  summary: { grossCents: number; feeCents: number; netCents: number; payments: number; supporters: number; periodViews: number; totalViews: number; availableCents: number; pendingPayoutCents: number; paidOutCents: number; feePercent: number; payoutMinimumCents: number };
  videos: { id: string; title: string; thumbnailUrl: string | null; totalViews: number; payments: number; netCents: number }[];
  monthly: ({ month: string; netCents: number } & Record<EarningKind, number>)[];
  tips: { day: string; netCents: number }[];
  lines: { id: string; createdAt: string; kind: EarningKind; videoTitle: string | null; supporter: string | null; netCents: number }[];
  payouts: { id: string; amountCents: number; status: "REQUESTED" | "UNDER_REVIEW" | "PROCESSING" | "SETTLED" | "FAILED"; createdAt: string }[];
  payoutAccount: { method: string; hint: string; holderName: string } | null;
}

const PERIODS: Period[] = ["30d", "90d", "12m", "all"];
const card = "rounded-3xl border border-border-default bg-surface-1/60 p-5 shadow-xs";
const STATUS_TONE: Record<string, BadgeProps["tone"]> = {
  SETTLED: "success",
  FAILED: "danger",
  REQUESTED: "neutral",
  UNDER_REVIEW: "warning",
  PROCESSING: "accent",
};

function Stat({ icon: Icon, label, value, hint, action, extra }: { icon: React.ElementType; label: string; value: React.ReactNode; hint?: string; action?: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2 text-xs font-semibold text-fg-secondary">
        <Icon className="h-4 w-4 text-accent" /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-black tabular-nums tracking-tight text-fg sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-fg-muted">{hint}</p>}
      {extra}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

const compactFormat: Intl.NumberFormatOptions = { notation: "compact", maximumFractionDigits: 1 };
const USD = { style: "money", currency: "USD" } as const;

/** A creator's earnings and payouts. Period and sort live in the address (?period=…&sort=…); payouts at #payouts. */
function EarningsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const period = (PERIODS as string[]).includes(params.get("period") ?? "") ? (params.get("period") as Period) : "30d";
  const sort: Sort = params.get("sort") === "views" ? "views" : "net";
  const [data, setData] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}${window.location.hash}`, { scroll: false });
  };

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/creator/earnings?period=${period}`, { cache: "no-store" });
    if (res.ok) setData((await res.json()) as Earnings);
    setLoading(false);
  }, [period]);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <Link href="/auth/login?next=/earnings" className={orochiaButton({ variant: "sensual", shape: "pill" })}>
          {t("nav.signIn")}
        </Link>
      </div>
    );
  }

  const s = data?.summary;
  const videos = [...(data?.videos ?? [])].sort((a, b) => (sort === "views" ? b.totalViews - a.totalViews : b.netCents - a.netCents));
  const earning = (data?.videos ?? []).filter((v) => v.netCents > 0);
  const low = [...earning].sort((a, b) => a.netCents - b.netCents).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-fg">{t("earnings.title")}</h1>
          <p className="mt-1 text-sm text-fg-secondary">{t("earnings.subtitle")}</p>
        </div>
        <Chip.Group type="single" required size="sm" label={t("earnings.period")} value={period} onValueChange={(p) => setParam("period", p, "30d")}>
          {PERIODS.map((p) => (
            <Chip key={p} value={p}>
              {t(`earnings.periods.${p}`)}
            </Chip>
          ))}
        </Chip.Group>
      </header>

      {!s ? (
        <div className="flex justify-center py-24">
          <Loader variant="block" label={t("earnings.loading")} />
        </div>
      ) : (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat
              icon={Wallet}
              label={t("earnings.net")}
              value={<MoneyTicker cents={s.netCents} trigger="change" align="start" />}
              hint={t("earnings.netHint", { fee: s.feePercent, payments: s.payments })}
              extra={
                data!.tips.some((d) => d.netCents > 0) && (
                  <Sparkline
                    title={t("earnings.tipsPulse")}
                    data={data!.tips.map((d) => d.netCents)}
                    categories={data!.tips.map((d) => d.day)}
                    variant="area"
                    format={USD}
                    height={32}
                    className="mt-2"
                  />
                )
              }
            />
            <Stat
              icon={Landmark}
              label={t("earnings.available")}
              value={<MoneyTicker cents={s.availableCents} trigger="change" align="start" />}
              hint={s.pendingPayoutCents > 0 ? t("earnings.pending", { amount: money(s.pendingPayoutCents) }) : undefined}
              action={
                <Button variant="sensual" size="sm" shimmer={s.availableCents >= s.payoutMinimumCents} onClick={() => (data?.payoutAccount ? setWithdrawOpen(true) : setAccountOpen(true))}>
                  {t("earnings.withdraw")}
                </Button>
              }
            />
            <Stat icon={Eye} label={t("earnings.views")} value={<NumberTicker value={s.totalViews} format={compactFormat} trigger="change" align="start" />} hint={t("earnings.viewsHint", { count: compact(s.periodViews) })} />
            <Stat icon={Users} label={t("earnings.supporters")} value={<NumberTicker value={s.supporters} format={compactFormat} trigger="change" align="start" />} hint={t("earnings.supportersHint", { amount: money(s.grossCents) })} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className={cn(card, "lg:col-span-2")} aria-labelledby="trend-title">
              <h2 id="trend-title" className="text-sm font-bold text-fg">{t("earnings.trend")}</h2>
              <AreaChart
                title={t("earnings.trendLabel")}
                hideTitle
                description={t("earnings.trendLabel")}
                data={data!.monthly.some((m) => m.netCents > 0) ? data!.monthly : []}
                x="month"
                xFormat="month"
                xLabel={t("earnings.month")}
                series={EARNING_KINDS.map((k) => ({ key: k, label: t(`earnings.kinds.${k}`) }))}
                stacked
                format={USD}
                height={300}
                empty={<EmptyState bird="flamingo" title={t("earnings.noTransactions")} />}
              />
            </section>
            <div className="grid grid-cols-1 gap-6">
              <section className={card} aria-labelledby="goal-title">
                <h2 id="goal-title" className="sr-only">{t("earnings.goal.title")}</h2>
                <Gauge
                  title={t("earnings.goal.title")}
                  value={s.availableCents}
                  max={Math.max(s.payoutMinimumCents, s.availableCents)}
                  format={USD}
                  caption={t("earnings.goal.caption")}
                  target={{ value: s.payoutMinimumCents, label: t("earnings.goal.target"), tone: "success" }}
                  tone={s.availableCents >= s.payoutMinimumCents ? "success" : "accent"}
                  height={150}
                  description={
                    s.availableCents >= s.payoutMinimumCents
                      ? t("earnings.goal.ready")
                      : t("earnings.goal.toGo", { amount: money(s.payoutMinimumCents - s.availableCents) })
                  }
                />
              </section>
              <section className={cn(card, "space-y-4")} aria-labelledby="split-title">
                <h2 id="split-title" className="text-sm font-bold text-fg">{t("earnings.split.title")}</h2>
                {s.grossCents > 0 ? (
                  <Meter
                    label={t("earnings.split.label")}
                    size="lg"
                    max={s.grossCents}
                    parts={[
                      { label: t("earnings.split.you"), value: s.netCents, valueText: money(s.netCents) },
                      { label: t("earnings.split.platform"), value: s.feeCents, valueText: money(s.feeCents) },
                    ]}
                  />
                ) : (
                  <p className="text-xs text-fg-muted">{t("earnings.split.none")}</p>
                )}
                <p className="text-[11px] leading-relaxed text-fg-muted">{t("earnings.split.hint", { percent: 100 - s.feePercent })}</p>
              </section>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <section className={card} aria-labelledby="videos-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="videos-title" className="text-sm font-bold text-fg">{t("earnings.videos")}</h2>
                <Chip.Group type="single" required size="sm" label={t("earnings.sortBy")} value={sort} onValueChange={(v) => setParam("sort", v, "net")}>
                  {(["net", "views"] as const).map((v) => (
                    <Chip key={v} value={v}>
                      {t(`earnings.sort.${v}`)}
                    </Chip>
                  ))}
                </Chip.Group>
              </div>
              {videos.length === 0 ? (
                <EmptyState bird="duck" title={t("earnings.noVideos")} className="border-0" />
              ) : (
                <ol className="max-h-80 space-y-1 overflow-y-auto pr-1">
                  {videos.map((v, i) => (
                    <li key={v.id}>
                      <Link href={`/watch/${v.id}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-surface-2">
                        <span className="w-5 text-right font-mono text-[11px] text-fg-muted">{i + 1}</span>
                        <span className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-media">{v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <Film className="m-auto mt-2.5 h-5 w-5 text-fg-muted" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fg">{v.title}</span>
                          <span className="block text-[11px] text-fg-muted">{t("earnings.videoMeta", { views: compact(v.totalViews), payments: v.payments })}</span>
                        </span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-fg">{money(v.netCents)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              {low.length > 0 && earning.length > 3 && (
                <p className="mt-3 border-t border-border-subtle pt-3 text-[11px] text-fg-muted">
                  {t("earnings.low")}: {low.map((v) => `${v.title} (${money(v.netCents)})`).join(" · ")}
                </p>
              )}
            </section>
          </div>

          <section className={card} aria-labelledby="tx-title">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="tx-title" className="text-sm font-bold text-fg">{t("earnings.transactions")}</h2>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/creator/earnings/export?kind=transactions&period=${period}`} className={buttonVariants({ size: "sm", shape: "pill" })} download>
                  <Download className="h-3.5 w-3.5" /> {t("earnings.exportTransactions")}
                </a>
                <a href={`/api/creator/earnings/export?kind=videos&period=${period}`} className={buttonVariants({ size: "sm", shape: "pill" })} download>
                  <Download className="h-3.5 w-3.5" /> {t("earnings.exportVideos")}
                </a>
              </div>
            </div>
            <PaymentsTable lines={data!.lines} />
          </section>

          <section id="payouts" className={cn(card, "scroll-mt-24")} aria-labelledby="payouts-title">
            <h2 id="payouts-title" className="mb-4 text-sm font-bold text-fg">{t("earnings.payouts")}</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-fg-secondary">{t("earnings.payoutAccount")}</p>
                {data!.payoutAccount ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-border-default p-4">
                    <Landmark className="h-5 w-5 shrink-0 text-accent" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm text-fg">{data!.payoutAccount.hint}</span>
                      <span className="block text-[11px] text-fg-muted">{data!.payoutAccount.holderName}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setAccountOpen(true)}>
                      {t("earnings.changeAccount")}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border-strong p-4 text-sm text-fg-secondary">
                    <p>{t("earnings.noAccount")}</p>
                    <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAccountOpen(true)}>
                      {t("earnings.addAccount")}
                    </Button>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-fg-muted">{t("earnings.paidOut", { amount: money(s.paidOutCents) })}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-fg-secondary">{t("earnings.history")}</p>
                {data!.payouts.length === 0 ? (
                  <p className="text-xs text-fg-muted">{t("earnings.noPayouts")}</p>
                ) : (
                  <ul className="divide-y divide-border-subtle">
                    {data!.payouts.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="text-xs text-fg-muted">{new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <Badge tone={STATUS_TONE[p.status] ?? "neutral"} className="normal-case tracking-normal">{t(`earnings.statuses.${p.status}`)}</Badge>
                        <span className="font-mono font-semibold tabular-nums text-fg">{money(p.amountCents)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      <PayoutAccountSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onSaved={() => {
          setAccountOpen(false);
          void load();
        }}
      />
      {data?.payoutAccount && (
        <WithdrawSheet open={withdrawOpen} onClose={() => setWithdrawOpen(false)} availableCents={s?.availableCents ?? 0} destinationHint={data.payoutAccount.hint} onDone={() => void load()} />
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <EarningsPage />
    </Suspense>
  );
}
