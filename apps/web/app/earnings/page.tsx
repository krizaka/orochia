"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Eye, Film, Landmark, Loader2, Users, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button, Segmented, buttonClass, cx } from "@/components/ui";
import { MonthlyChart } from "@/components/money/MonthlyChart";
import { PayoutAccountSheet } from "@/components/money/PayoutAccountSheet";
import { WithdrawSheet } from "@/components/money/WithdrawSheet";
import { compact, money } from "@/lib/money";
import { t } from "@/lib/i18n";

type Period = "30d" | "90d" | "12m" | "all";
type Sort = "net" | "views";
interface Earnings {
  summary: { grossCents: number; netCents: number; payments: number; supporters: number; periodViews: number; totalViews: number; availableCents: number; pendingPayoutCents: number; paidOutCents: number; feePercent: number };
  videos: { id: string; title: string; thumbnailUrl: string | null; totalViews: number; payments: number; netCents: number }[];
  monthly: { month: string; netCents: number }[];
  lines: { id: string; createdAt: string; kind: "tip" | "unlock"; videoTitle: string | null; supporter: string | null; netCents: number }[];
  payouts: { id: string; amountCents: number; status: "REQUESTED" | "UNDER_REVIEW" | "PROCESSING" | "SETTLED" | "FAILED"; createdAt: string }[];
  payoutAccount: { method: string; hint: string; holderName: string } | null;
}

const PERIODS: Period[] = ["30d", "90d", "12m", "all"];
const card = "rounded-3xl border border-white/10 bg-zinc-950/60 p-5 light:border-black/5 light:bg-white light:shadow-xs";
const STATUS_TONE: Record<string, string> = {
  SETTLED: "bg-emerald-500/15 text-emerald-300 light:text-emerald-700",
  FAILED: "bg-rose-500/15 text-rose-300 light:text-rose-700",
  REQUESTED: "bg-white/10 text-zinc-200 light:bg-black/5 light:text-slate-700",
  UNDER_REVIEW: "bg-amber-500/15 text-amber-200 light:text-amber-800",
  PROCESSING: "bg-sky-500/15 text-sky-200 light:text-sky-800",
};

function Stat({ icon: Icon, label, value, hint, action }: { icon: React.ElementType; label: string; value: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400 light:text-slate-500">
        <Icon className="h-4 w-4 text-violet-400 light:text-violet-600" /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-black tabular-nums tracking-tight text-white sm:text-3xl light:text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

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
        <Link href="/auth/login?next=/earnings" className={buttonClass({ variant: "primary" })}>
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
          <h1 className="font-display text-3xl font-black tracking-tight text-white light:text-slate-900">{t("earnings.title")}</h1>
          <p className="mt-1 text-sm text-zinc-400 light:text-slate-500">{t("earnings.subtitle")}</p>
        </div>
        <div className="w-full sm:w-88">
          <Segmented label={t("earnings.title")} value={period} onChange={(p) => setParam("period", p, "30d")} options={PERIODS.map((p) => ({ value: p, label: t(`earnings.periods.${p}`) }))} />
        </div>
      </header>

      {!s ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
        </div>
      ) : (
        <div className={cx("space-y-6 transition-opacity", loading && "opacity-60")}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat icon={Wallet} label={t("earnings.net")} value={money(s.netCents)} hint={t("earnings.netHint", { fee: s.feePercent, payments: s.payments })} />
            <Stat
              icon={Landmark}
              label={t("earnings.available")}
              value={money(s.availableCents)}
              hint={s.pendingPayoutCents > 0 ? t("earnings.pending", { amount: money(s.pendingPayoutCents) }) : undefined}
              action={
                <Button variant="primary" size="sm" onClick={() => (data?.payoutAccount ? setWithdrawOpen(true) : setAccountOpen(true))}>
                  {t("earnings.withdraw")}
                </Button>
              }
            />
            <Stat icon={Eye} label={t("earnings.views")} value={compact(s.totalViews)} hint={t("earnings.viewsHint", { count: compact(s.periodViews) })} />
            <Stat icon={Users} label={t("earnings.supporters")} value={compact(s.supporters)} hint={t("earnings.supportersHint", { amount: money(s.grossCents) })} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className={card} aria-labelledby="trend-title">
              <h2 id="trend-title" className="text-sm font-bold text-white light:text-slate-900">{t("earnings.trend")}</h2>
              <p className="mb-3 text-[11px] text-zinc-500">{t("earnings.trendLabel")}</p>
              <MonthlyChart data={data!.monthly} label={t("earnings.trendLabel")} />
            </section>

            <section className={card} aria-labelledby="videos-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="videos-title" className="text-sm font-bold text-white light:text-slate-900">{t("earnings.videos")}</h2>
                <div className="w-44">
                  <Segmented label={t("earnings.sortBy")} value={sort} onChange={(v) => setParam("sort", v, "net")} options={(["net", "views"] as const).map((v) => ({ value: v, label: t(`earnings.sort.${v}`) }))} />
                </div>
              </div>
              {videos.length === 0 ? (
                <p className="py-8 text-center text-xs text-zinc-500">{t("earnings.noVideos")}</p>
              ) : (
                <ol className="max-h-80 space-y-1 overflow-y-auto pr-1">
                  {videos.map((v, i) => (
                    <li key={v.id}>
                      <Link href={`/watch/${v.id}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/5 hover:light:bg-black/3">
                        <span className="w-5 text-right font-mono text-[11px] text-zinc-500">{i + 1}</span>
                        <span className="h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-800">{v.thumbnailUrl ? <img src={v.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <Film className="m-auto mt-2.5 h-5 w-5 text-zinc-600" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white light:text-slate-900">{v.title}</span>
                          <span className="block text-[11px] text-zinc-500">{t("earnings.videoMeta", { views: compact(v.totalViews), payments: v.payments })}</span>
                        </span>
                        <span className="font-mono text-sm font-semibold tabular-nums text-white light:text-slate-900">{money(v.netCents)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              {low.length > 0 && earning.length > 3 && (
                <p className="mt-3 border-t border-white/5 pt-3 text-[11px] text-zinc-500 light:border-black/5">
                  {t("earnings.low")}: {low.map((v) => `${v.title} (${money(v.netCents)})`).join(" · ")}
                </p>
              )}
            </section>
          </div>

          <section className={card} aria-labelledby="tx-title">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="tx-title" className="text-sm font-bold text-white light:text-slate-900">{t("earnings.transactions")}</h2>
              <div className="flex flex-wrap gap-2">
                <a href={`/api/creator/earnings/export?kind=transactions&period=${period}`} className={buttonClass({ size: "sm" })} download>
                  <Download className="h-3.5 w-3.5" /> {t("earnings.exportTransactions")}
                </a>
                <a href={`/api/creator/earnings/export?kind=videos&period=${period}`} className={buttonClass({ size: "sm" })} download>
                  <Download className="h-3.5 w-3.5" /> {t("earnings.exportVideos")}
                </a>
              </div>
            </div>
            {data!.lines.length === 0 ? (
              <p className="py-8 text-center text-xs text-zinc-500">{t("earnings.noTransactions")}</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <tbody className="divide-y divide-white/5 light:divide-black/5">
                    {data!.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="whitespace-nowrap px-5 py-2.5 text-xs text-zinc-500">{new Date(l.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                        <td className="px-2 py-2.5">
                          <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-semibold text-violet-200 light:text-violet-700">{t(`earnings.kinds.${l.kind}`)}</span>
                        </td>
                        <td className="max-w-[16rem] truncate px-2 py-2.5 text-zinc-200 light:text-slate-700">{l.videoTitle ?? "—"}</td>
                        <td className="px-2 py-2.5 text-xs text-zinc-400 light:text-slate-500">{l.supporter ?? ""}</td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right font-mono font-semibold tabular-nums text-emerald-300 light:text-emerald-700">+{money(l.netCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section id="payouts" className={cx(card, "scroll-mt-24")} aria-labelledby="payouts-title">
            <h2 id="payouts-title" className="mb-4 text-sm font-bold text-white light:text-slate-900">{t("earnings.payouts")}</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-400 light:text-slate-500">{t("earnings.payoutAccount")}</p>
                {data!.payoutAccount ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 p-4 light:border-black/10">
                    <Landmark className="h-5 w-5 shrink-0 text-violet-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-sm text-white light:text-slate-900">{data!.payoutAccount.hint}</span>
                      <span className="block text-[11px] text-zinc-500">{data!.payoutAccount.holderName}</span>
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => setAccountOpen(true)}>
                      {t("earnings.changeAccount")}
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-zinc-400 light:border-black/15 light:text-slate-600">
                    <p>{t("earnings.noAccount")}</p>
                    <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAccountOpen(true)}>
                      {t("earnings.addAccount")}
                    </Button>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-zinc-500">{t("earnings.paidOut", { amount: money(s.paidOutCents) })}</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-zinc-400 light:text-slate-500">{t("earnings.history")}</p>
                {data!.payouts.length === 0 ? (
                  <p className="text-xs text-zinc-500">{t("earnings.noPayouts")}</p>
                ) : (
                  <ul className="divide-y divide-white/5 light:divide-black/5">
                    {data!.payouts.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="text-xs text-zinc-500">{new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[p.status])}>{t(`earnings.statuses.${p.status}`)}</span>
                        <span className="font-mono font-semibold tabular-nums text-white light:text-slate-900">{money(p.amountCents)}</span>
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
