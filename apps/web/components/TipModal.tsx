"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, CreditCard, ShieldCheck, Bitcoin, CheckCircle2 } from "lucide-react";
import { Button, Sheet, cx } from "@/components/ui";
import { t } from "@/lib/i18n";

type Gateway = "CREDITS" | "CCBILL" | "SEGPAY" | "CRYPTO" | "STRIPE";
/** The ways to pay, in display order (only those the deployment offers are shown). */
const METHODS: { id: Gateway; icon: React.ElementType; tone: string }[] = [
  { id: "CREDITS", icon: Sparkles, tone: "text-fuchsia-400" },
  { id: "CCBILL", icon: CreditCard, tone: "text-violet-400" },
  { id: "SEGPAY", icon: ShieldCheck, tone: "text-emerald-400" },
  { id: "STRIPE", icon: CreditCard, tone: "text-sky-400" },
  { id: "CRYPTO", icon: Bitcoin, tone: "text-amber-400" },
];

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  creatorName: string;
  minTipAmountCents: number;
  onUnlockedSuccess: () => void;
}

export function TipModal({
  isOpen,
  onClose,
  videoId,
  creatorName,
  minTipAmountCents,
  onUnlockedSuccess,
}: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(
    Math.max(1000, minTipAmountCents)
  );
  const [selectedGateway, setSelectedGateway] = useState<Gateway>("CREDITS");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Credits did not cover the amount: offer to add some (the wallet) with the current balance.
  const [creditsShort, setCreditsShort] = useState<number | null>(null);
  const [gateways, setGateways] = useState<string[] | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  // Only the gateways this deployment is configured for are offered.
  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/payments/gateways", { cache: "no-store" })
      .then((res) => res.json())
      .then((data: { gateways: string[]; demoMode: boolean }) => {
        setGateways(data.gateways);
        setDemoMode(data.demoMode);
        if (data.gateways.length > 0 && !data.gateways.includes(selectedGateway)) {
          setSelectedGateway(data.gateways[0] as typeof selectedGateway);
        }
      })
      .catch(() => setGateways([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const offers = (gateway: string) => demoMode || (gateways ?? []).includes(gateway);
  const unavailable = gateways !== null && gateways.length === 0 && !demoMode;

  if (!isOpen) return null;

  const presets = [
    { label: "$5", cents: 500 },
    { label: "$10", cents: 1000 },
    { label: "$25", cents: 2500 },
    { label: "$50", cents: 5000 },
  ];

  const handleProcessTip = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    setCreditsShort(null);

    try {
      // The server records a payment intent and answers with the gateway's checkout page; access
      // is granted when the gateway's signed webhook confirms the payment.
      const res = await fetch("/api/videos/unlock-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, amountCents: selectedAmount, gateway: selectedGateway }),
      });

      const data = (await res.json()) as { error?: string; checkoutUrl?: string; settled?: boolean; balanceCents?: number };
      if (res.status === 402) {
        setCreditsShort(data.balanceCents ?? 0);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || t("payments.startFailed", { name: creatorName }));
      }
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      if (data.settled) {
        onUnlockedSuccess();
        onClose();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error && err.message ? err.message : t("payments.failed"));
    } finally {
      setIsProcessing(false);
    }
  };

  const usdOf = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <Sheet
      open={isOpen}
      onClose={onClose}
      title={t("payments.title", { name: creatorName })}
      footer={
        <>
          {creditsShort !== null && (
            <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100 light:text-amber-800">
              <span>{t("wallet.short", { balance: usdOf(creditsShort) })}</span>
              <Link href="/wallet" className="shrink-0 rounded-full bg-amber-400 px-3 py-1.5 font-bold text-zinc-950">
                {t("wallet.add")}
              </Link>
            </div>
          )}
          {unavailable && <p className="mb-3 text-xs text-amber-300 light:text-amber-700">{t("payments.unavailable")}</p>}
          <Button variant="primary" size="lg" round={false} className="w-full" disabled={unavailable} loading={isProcessing} onClick={() => void handleProcessTip()}>
            {isProcessing ? t("payments.processing") : t("payments.pay", { amount: usdOf(selectedAmount) })}
          </Button>
          <p className="mt-3 text-center text-[11px] text-zinc-500 light:text-slate-500">{t("payments.discreet")}</p>
        </>
      }
    >
      <p className="-mt-1 mb-5 text-sm text-zinc-400 light:text-slate-500">{t("payments.subtitle")}</p>

      {errorMsg && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 light:text-rose-700">
          {errorMsg}
        </div>
      )}

      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-xs font-semibold text-zinc-300 light:text-slate-700">{t("payments.amount")}</span>
          {minTipAmountCents > 100 && <span className="text-[11px] text-zinc-500">{t("payments.minimum", { amount: usdOf(minTipAmountCents) })}</span>}
        </div>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("payments.amount")}>
          {presets.map((p) => {
            const allowed = p.cents >= minTipAmountCents;
            const selected = selectedAmount === p.cents;
            return (
              <button
                key={p.cents}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!allowed}
                onClick={() => setSelectedAmount(p.cents)}
                className={cx(
                  "rounded-xl border py-3 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-30",
                  selected ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-600/30" : "border-white/10 text-zinc-200 hover:border-violet-500/50 light:border-black/10 light:text-slate-800",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <span className="mb-2 block text-xs font-semibold text-zinc-300 light:text-slate-700">{t("payments.method")}</span>
      <div className="space-y-2" role="radiogroup" aria-label={t("payments.method")}>
        {METHODS.filter((m) => offers(m.id)).map(({ id, icon: Icon, tone }) => {
          const selected = selectedGateway === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSelectedGateway(id)}
              className={cx(
                "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400",
                selected ? "border-violet-500 bg-violet-500/10" : "border-white/10 hover:border-white/25 light:border-black/10 light:hover:border-black/25",
              )}
            >
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 light:bg-black/5", tone)}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white light:text-slate-900">{id === "CREDITS" ? t("payments.credits.title") : t(`payments.gateways.${id}.title`)}</span>
                <span className="block text-xs text-zinc-400 light:text-slate-500">{id === "CREDITS" ? t("payments.credits.hint") : t(`payments.gateways.${id}.hint`)}</span>
              </span>
              {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-violet-400" />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
