"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Coins, Gavel, Loader2, Lock, RotateCcw, Sparkles, Undo2, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button, cx } from "@/components/ui";
import { money } from "@/lib/money";
import { t, type MessageKey } from "@/lib/i18n";

interface Pack {
  id: string;
  priceCents: number;
  creditsCents: number;
}
interface Wallet {
  balanceCents: number;
  heldCents: number;
  packs: Pack[];
  gateways: string[];
  testTopups: boolean;
  history: { id: string; type: "TOPUP" | "SPEND" | "REFUND" | "ADJUSTMENT" | "HOLD" | "RELEASE"; amountCents: number; createdAt: string }[];
}

const POPULAR = "plus";
const TYPE_ICON = { TOPUP: ArrowDownLeft, REFUND: RotateCcw, SPEND: ArrowUpRight, ADJUSTMENT: Coins, HOLD: Gavel, RELEASE: Undo2 };

/** The wallet: credits balance, buying credits through a hosted checkout, and every movement. */
function WalletPage() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [pack, setPack] = useState(POPULAR);
  const [gateway, setGateway] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "info" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/me/wallet", { cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as Wallet;
    setWallet(data);
    setGateway((g) => g ?? data.gateways[0] ?? (data.testTopups ? "TEST" : null));
  }, []);
  useEffect(() => {
    if (user) void load();
  }, [user, load]);
  useEffect(() => {
    const status = params.get("topup");
    if (status === "success") setNotice({ tone: "ok", text: t("wallet.success") });
    else if (status === "cancelled") setNotice({ tone: "info", text: t("wallet.cancelled") });
  }, [params]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <Link href="/auth/login?next=/wallet" className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white">
          {t("nav.signIn")}
        </Link>
      </div>
    );
  }

  const methods = wallet ? [...wallet.gateways, ...(wallet.testTopups ? ["TEST"] : [])] : [];
  const chosen = wallet?.packs.find((p) => p.id === pack);

  const buy = async () => {
    if (!chosen || !gateway) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/me/wallet/topups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packId: chosen.id, gateway }) });
    const data = (await res.json().catch(() => ({}))) as { checkoutUrl?: string; settled?: boolean; error?: string };
    if (res.ok && data.checkoutUrl) {
      window.location.assign(data.checkoutUrl);
      return;
    }
    setBusy(false);
    if (res.ok && data.settled) {
      setNotice({ tone: "ok", text: t("wallet.testSuccess") });
      await load();
    } else setNotice({ tone: "error", text: data.error || t("wallet.failed") });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-black tracking-tight text-white light:text-slate-900">{t("wallet.title")}</h1>
        <p className="mt-1 text-sm text-zinc-400 light:text-slate-500">{t("wallet.subtitle")}</p>
      </header>

      {notice && (
        <div
          role="status"
          className={cx(
            "mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
            notice.tone === "ok" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 light:text-emerald-800",
            notice.tone === "info" && "border-white/10 bg-white/5 text-zinc-200 light:border-black/10 light:bg-black/3 light:text-slate-700",
            notice.tone === "error" && "border-rose-500/30 bg-rose-500/10 text-rose-200 light:text-rose-700",
          )}
        >
          {notice.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Balance + buy */}
        <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/60 light:border-black/5 light:bg-white light:shadow-xl light:shadow-violet-900/5">
          <div className="relative overflow-hidden bg-[radial-gradient(120%_140%_at_0%_0%,rgba(139,92,246,0.45),transparent_60%),radial-gradient(100%_120%_at_100%_100%,rgba(236,72,153,0.35),transparent_60%)] px-6 py-7 light:bg-[radial-gradient(120%_140%_at_0%_0%,rgba(139,92,246,0.18),transparent_60%),radial-gradient(100%_120%_at_100%_100%,rgba(236,72,153,0.14),transparent_60%)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-200 light:text-violet-700">{t("wallet.balance")}</p>
            <p className="mt-1 font-display text-5xl font-black tabular-nums tracking-tight text-white light:text-slate-900">{wallet ? money(wallet.balanceCents) : "—"}</p>
            {wallet && wallet.heldCents > 0 && (
              <Link href="/auctions?tab=bidding" className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[11px] font-semibold text-violet-100 transition-colors hover:border-white/30 hover:text-white light:border-violet-900/10 light:bg-white/60 light:text-violet-800 hover:light:border-violet-900/25">
                <Gavel className="h-3 w-3" aria-hidden /> {t("wallet.held", { amount: money(wallet.heldCents) })}
              </Link>
            )}
          </div>

          <div className="p-6">
            <h2 className="mb-3 text-sm font-bold text-white light:text-slate-900">{t("wallet.choosePack")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={t("wallet.choosePack")}>
              {(wallet?.packs ?? []).map((p) => {
                const bonus = p.creditsCents - p.priceCents;
                const active = p.id === pack;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPack(p.id)}
                    className={cx(
                      "relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400",
                      active ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-900/20" : "border-white/10 hover:border-white/25 light:border-black/10 hover:light:border-black/25",
                    )}
                  >
                    {p.id === POPULAR && <span className="absolute -top-2.5 left-3 rounded-full bg-linear-to-r from-violet-600 to-fuchsia-600 px-2 py-0.5 text-[10px] font-bold text-white">{t("wallet.popular")}</span>}
                    <span className="font-display text-xl font-black text-white light:text-slate-900">{money(p.priceCents)}</span>
                    <span className="mt-0.5 text-[11px] font-semibold text-emerald-300 light:text-emerald-700">{bonus > 0 ? t("wallet.bonus", { amount: money(bonus) }) : " "}</span>
                  </button>
                );
              })}
              {!wallet && Array.from({ length: 4 }, (_, i) => <span key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />)}
            </div>

            <h2 className="mb-3 mt-6 text-sm font-bold text-white light:text-slate-900">{t("wallet.payWith")}</h2>
            {wallet && methods.length === 0 ? (
              <p className="rounded-2xl border border-white/10 p-4 text-sm text-zinc-400 light:border-black/10 light:text-slate-500">{t("wallet.noGateway")}</p>
            ) : (
              <div className="grid gap-2" role="radiogroup" aria-label={t("wallet.payWith")}>
                {methods.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={gateway === g}
                    onClick={() => setGateway(g)}
                    className={cx(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400",
                      gateway === g ? "border-violet-500 bg-violet-500/10 text-white light:text-slate-900" : "border-white/10 text-zinc-300 hover:border-white/25 light:border-black/10 light:text-slate-700 hover:light:border-black/25",
                    )}
                  >
                    <span className={cx("flex h-4 w-4 items-center justify-center rounded-full border-2", gateway === g ? "border-violet-400" : "border-zinc-500")}>{gateway === g && <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />}</span>
                    {g === "TEST" ? <Sparkles className="h-4 w-4 text-amber-300" /> : <Lock className="h-4 w-4 text-zinc-400" />}
                    {t(`wallet.gateways.${g}` as MessageKey)}
                  </button>
                ))}
              </div>
            )}

            <Button variant="primary" size="lg" round={false} className="mt-6 w-full" disabled={!chosen || !gateway} loading={busy} onClick={() => void buy()}>
              {busy ? t("wallet.processing") : chosen ? t("wallet.pay", { price: money(chosen.priceCents) }) : t("wallet.add")}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-zinc-500">
              <Lock className="h-3 w-3" /> {t("wallet.secure")}
            </p>
          </div>
        </section>

        {/* History */}
        <section className="rounded-[1.75rem] border border-white/10 bg-zinc-950/60 p-5 light:border-black/5 light:bg-white">
          <h2 className="mb-3 text-sm font-bold text-white light:text-slate-900">{t("wallet.history")}</h2>
          {!wallet ? (
            <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-violet-400" />
          ) : wallet.history.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-500">{t("wallet.empty")}</p>
          ) : (
            <ul className="divide-y divide-white/5 light:divide-black/5">
              {wallet.history.map((h) => {
                const Icon = TYPE_ICON[h.type];
                return (
                  <li key={h.id} className="flex items-center gap-3 py-3">
                    <span className={cx("flex h-9 w-9 items-center justify-center rounded-full", h.amountCents >= 0 ? "bg-emerald-500/15 text-emerald-300 light:text-emerald-700" : "bg-white/5 text-zinc-300 light:bg-black/5 light:text-slate-600")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-white light:text-slate-900">{t(`wallet.types.${h.type}`)}</span>
                      <span className="block text-[11px] text-zinc-500">{new Date(h.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </span>
                    <span className={cx("font-mono text-sm font-semibold tabular-nums", h.amountCents >= 0 ? "text-emerald-300 light:text-emerald-700" : "text-zinc-300 light:text-slate-700")}>
                      {h.amountCents >= 0 ? "+" : "−"}
                      {money(Math.abs(h.amountCents))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <WalletPage />
    </Suspense>
  );
}
