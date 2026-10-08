"use client";

import React, { useEffect, useState } from "react";
import { X, Sparkles, CreditCard, ShieldCheck, Bitcoin, CheckCircle2 } from "lucide-react";

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
  const [selectedGateway, setSelectedGateway] = useState<"CCBILL" | "SEGPAY" | "CRYPTO" | "STRIPE">("CCBILL");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

    try {
      // The server records a payment intent and answers with the gateway's checkout page; access
      // is granted when the gateway's signed webhook confirms the payment.
      const res = await fetch("/api/videos/unlock-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, amountCents: selectedAmount, gateway: selectedGateway }),
      });

      const data = (await res.json()) as { error?: string; checkoutUrl?: string; settled?: boolean };
      if (!res.ok) {
        throw new Error(data.error || `Could not start the payment for ${creatorName}`);
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
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-950 dark:bg-zinc-950 light:bg-white p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white dark:hover:text-white light:hover:text-black transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white dark:text-white light:text-slate-900">Tip {creatorName}</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500">Unlock this exclusive video & support creator directly</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Amount Presets */}
        <div className="mb-5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-400 light:text-slate-500 mb-2 block">
            Select Tip Amount
          </label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((p) => {
              const isAllowed = p.cents >= minTipAmountCents;
              const isSelected = selectedAmount === p.cents;
              return (
                <button
                  key={p.cents}
                  disabled={!isAllowed}
                  onClick={() => setSelectedAmount(p.cents)}
                  className={`py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                    isSelected
                      ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : isAllowed
                      ? "border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900 dark:bg-zinc-900 light:bg-slate-100 text-zinc-200 dark:text-zinc-200 light:text-slate-800 hover:border-violet-500/40"
                      : "border-white/5 dark:border-white/5 light:border-black/5 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50 text-zinc-600 cursor-not-allowed"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Gateway Selection */}
        <div className="mb-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-400 light:text-slate-500 mb-2 block">
            Select Adult-Friendly Gateway
          </label>
          <div className="space-y-2">
            {offers("CCBILL") && (
              <label
                onClick={() => setSelectedGateway("CCBILL")}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedGateway === "CCBILL"
                    ? "border-violet-500 bg-violet-500/10 text-white dark:text-white light:text-violet-900"
                    : "border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/80 dark:bg-zinc-900/80 light:bg-slate-100 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-violet-400" />
                  <div>
                    <div className="text-sm font-semibold">CCBill Secure Checkout</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500">Adult-compliant Visa / Mastercard</div>
                  </div>
                </div>
                {selectedGateway === "CCBILL" && <CheckCircle2 className="h-5 w-5 text-violet-400" />}
              </label>
            )}

            {offers("CRYPTO") && (
              <label
                onClick={() => setSelectedGateway("CRYPTO")}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedGateway === "CRYPTO"
                    ? "border-amber-500 bg-amber-500/10 text-white dark:text-white light:text-amber-900"
                    : "border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/80 dark:bg-zinc-900/80 light:bg-slate-100 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bitcoin className="h-5 w-5 text-amber-400" />
                  <div>
                    <div className="text-sm font-semibold">Crypto Gateway (NowPayments)</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500">USDT, BTC, ETH, Solana</div>
                  </div>
                </div>
                {selectedGateway === "CRYPTO" && <CheckCircle2 className="h-5 w-5 text-amber-400" />}
              </label>
            )}

            {offers("SEGPAY") && (
              <label
                onClick={() => setSelectedGateway("SEGPAY")}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedGateway === "SEGPAY"
                    ? "border-emerald-500 bg-emerald-500/10 text-white dark:text-white light:text-emerald-900"
                    : "border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/80 dark:bg-zinc-900/80 light:bg-slate-100 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <div>
                    <div className="text-sm font-semibold">Segpay Global Pay</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500">Direct creator card billing</div>
                  </div>
                </div>
                {selectedGateway === "SEGPAY" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
              </label>
            )}

            {offers("STRIPE") && (
              <label
                onClick={() => setSelectedGateway("STRIPE")}
                className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedGateway === "STRIPE"
                    ? "border-sky-500 bg-sky-500/10 text-white dark:text-white light:text-sky-900"
                    : "border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/80 dark:bg-zinc-900/80 light:bg-slate-100 text-zinc-300 dark:text-zinc-300 light:text-slate-700 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-sky-400" />
                  <div>
                    <div className="text-sm font-semibold">Stripe Checkout</div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500">Cards and wallets</div>
                  </div>
                </div>
                {selectedGateway === "STRIPE" && <CheckCircle2 className="h-5 w-5 text-sky-400" />}
              </label>
            )}
          </div>
        </div>

        {/* Action Button */}
        {unavailable && (
          <p className="mb-3 text-xs text-amber-300">Payments are not available on this server yet.</p>
        )}
        <button
          disabled={isProcessing || unavailable}
          onClick={handleProcessTip}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-fuchsia-600/25 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-95"
        >
          {isProcessing ? "Processing Tip..." : `Pay $${(selectedAmount / 100).toFixed(2)} & Unlock Now`}
        </button>

        <p className="mt-3 text-center text-[11px] text-zinc-500 dark:text-zinc-500 light:text-slate-500">
          Discreet billing descriptor. 100% encrypted and adult-industry compliant.
        </p>
      </div>
    </div>
  );
}
