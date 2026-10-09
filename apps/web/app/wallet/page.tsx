"use client";

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Coins, Gavel, Lock, RotateCcw, Sparkles, Undo2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useCallback, useEffect, useState } from "react";

import { Badge, Button, cn, Skeleton, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { type MessageKey,t } from "@/lib/i18n";
import { money } from "@/lib/money";

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
        <Link href="/auth/login?next=/wallet" className="rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white">
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
        <h1 className="font-display text-3xl font-black tracking-tight text-fg">{t("wallet.title")}</h1>
        <p className="mt-1 text-sm text-fg-secondary">{t("wallet.subtitle")}</p>
      </header>

      {notice && (
        <div
          role="status"
          className={cn(
            "mb-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
            notice.tone === "ok" && "border-success/30 bg-success/10 text-success",
            notice.tone === "info" && "border-border-default bg-surface-2 text-fg",
            notice.tone === "error" && "border-danger/30 bg-danger/10 text-danger",
          )}
        >
          {notice.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {notice.text}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Balance + buy */}
        <section className="overflow-hidden rounded-[1.75rem] border border-border-default bg-surface-1/60 shadow-xl shadow-accent/5">
          <div className="relative overflow-hidden bg-linear-to-br from-accent/30 via-transparent to-accent-2/25 px-6 py-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("wallet.balance")}</p>
            <p className="mt-1 font-display text-5xl font-black tabular-nums tracking-tight text-fg">{wallet ? money(wallet.balanceCents) : "—"}</p>
            {wallet && wallet.heldCents > 0 && (
              <Link href="/auctions?tab=bidding" className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-1/60 px-3 py-1 text-[11px] font-semibold text-accent transition-colors hover:border-accent hover:text-fg">
                <Gavel className="h-3 w-3" aria-hidden /> {t("wallet.held", { amount: money(wallet.heldCents) })}
              </Link>
            )}
          </div>

          <div className="p-6">
            <h2 className="mb-3 text-sm font-bold text-fg">{t("wallet.choosePack")}</h2>
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
                    className={cn(
                      "relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-accent bg-accent/10 shadow-lg shadow-accent/20" : "border-border-default hover:border-border-strong",
                    )}
                  >
                    {p.id === POPULAR && <Badge size="sm" className="absolute -top-2.5 left-3 bg-linear-to-r from-accent to-accent-2 normal-case tracking-normal text-on-accent ring-0">{t("wallet.popular")}</Badge>}
                    <span className="font-display text-xl font-black text-fg">{money(p.priceCents)}</span>
                    <span className="mt-0.5 text-[11px] font-semibold text-success">{bonus > 0 ? t("wallet.bonus", { amount: money(bonus) }) : " "}</span>
                  </button>
                );
              })}
              {!wallet && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} shape="rect" className="h-20 rounded-2xl" />)}
            </div>

            <h2 className="mb-3 mt-6 text-sm font-bold text-fg">{t("wallet.payWith")}</h2>
            {wallet && methods.length === 0 ? (
              <p className="rounded-2xl border border-border-default p-4 text-sm text-fg-secondary">{t("wallet.noGateway")}</p>
            ) : (
              <div className="grid gap-2" role="radiogroup" aria-label={t("wallet.payWith")}>
                {methods.map((g) => (
                  <button
                    key={g}
                    type="button"
                    role="radio"
                    aria-checked={gateway === g}
                    onClick={() => setGateway(g)}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                      gateway === g ? "border-accent bg-accent/10 text-fg" : "border-border-default text-fg-secondary hover:border-border-strong",
                    )}
                  >
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border-2", gateway === g ? "border-accent" : "border-fg-muted")}>{gateway === g && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}</span>
                    {g === "TEST" ? <Sparkles className="h-4 w-4 text-warning" /> : <Lock className="h-4 w-4 text-fg-secondary" />}
                    {t(`wallet.gateways.${g}` as MessageKey)}
                  </button>
                ))}
              </div>
            )}

            <Button variant="sensual" size="lg" shape="rounded" className="mt-6 w-full" disabled={!chosen || !gateway} loading={busy} onClick={() => void buy()}>
              {busy ? t("wallet.processing") : chosen ? t("wallet.pay", { price: money(chosen.priceCents) }) : t("wallet.add")}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-fg-muted">
              <Lock className="h-3 w-3" /> {t("wallet.secure")}
            </p>
          </div>
        </section>

        {/* History */}
        <section className="rounded-[1.75rem] border border-border-default bg-surface-1/60 p-5">
          <h2 className="mb-3 text-sm font-bold text-fg">{t("wallet.history")}</h2>
          {!wallet ? (
            <Spinner size="md" className="mx-auto my-8" />
          ) : wallet.history.length === 0 ? (
            <p className="py-8 text-center text-xs text-fg-muted">{t("wallet.empty")}</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {wallet.history.map((h) => {
                const Icon = TYPE_ICON[h.type];
                return (
                  <li key={h.id} className="flex items-center gap-3 py-3">
                    <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", h.amountCents >= 0 ? "bg-success/15 text-success" : "bg-surface-2 text-fg-secondary")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">{t(`wallet.types.${h.type}`)}</span>
                      <span className="block text-[11px] text-fg-muted">{new Date(h.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </span>
                    <span className={cn("font-mono text-sm font-semibold tabular-nums", h.amountCents >= 0 ? "text-success" : "text-fg-secondary")}>
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
