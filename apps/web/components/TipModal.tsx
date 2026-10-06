"use client";

import React, { useState } from "react";
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
      // In production, triggers the checkout redirect or processes confirmed tip
      const res = await fetch("/api/videos/unlock-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          amountCents: selectedAmount,
          gateway: selectedGateway,
          transactionRef: `tx_demo_${Date.now()}`,
          note: `Tip for ${creatorName}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process tip");
      }

      onUnlockedSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-zinc-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Tip {creatorName}</h3>
            <p className="text-xs text-zinc-400">Unlock this exclusive video & support creator directly</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Amount Presets */}
        <div className="mb-5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 block">
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
                      ? "border-white/10 bg-zinc-900 text-zinc-200 hover:border-white/20"
                      : "border-white/5 bg-zinc-900/40 text-zinc-600 cursor-not-allowed"
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
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 block">
            Select Adult-Friendly Gateway
          </label>
          <div className="space-y-2">
            <label
              onClick={() => setSelectedGateway("CCBILL")}
              className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                selectedGateway === "CCBILL"
                  ? "border-violet-500 bg-violet-500/10 text-white"
                  : "border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-violet-400" />
                <div>
                  <div className="text-sm font-semibold">CCBill Secure Checkout</div>
                  <div className="text-xs text-zinc-400">Adult-compliant Visa / Mastercard</div>
                </div>
              </div>
              {selectedGateway === "CCBILL" && <CheckCircle2 className="h-5 w-5 text-violet-400" />}
            </label>

            <label
              onClick={() => setSelectedGateway("CRYPTO")}
              className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                selectedGateway === "CRYPTO"
                  ? "border-amber-500 bg-amber-500/10 text-white"
                  : "border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <Bitcoin className="h-5 w-5 text-amber-400" />
                <div>
                  <div className="text-sm font-semibold">Crypto Gateway (NowPayments)</div>
                  <div className="text-xs text-zinc-400">USDT, BTC, ETH, Solana</div>
                </div>
              </div>
              {selectedGateway === "CRYPTO" && <CheckCircle2 className="h-5 w-5 text-amber-400" />}
            </label>

            <label
              onClick={() => setSelectedGateway("SEGPAY")}
              className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                selectedGateway === "SEGPAY"
                  ? "border-emerald-500 bg-emerald-500/10 text-white"
                  : "border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-white/20"
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <div>
                  <div className="text-sm font-semibold">Segpay Global Pay</div>
                  <div className="text-xs text-zinc-400">Direct creator card billing</div>
                </div>
              </div>
              {selectedGateway === "SEGPAY" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            </label>
          </div>
        </div>

        {/* Action Button */}
        <button
          disabled={isProcessing}
          onClick={handleProcessTip}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-bold text-sm shadow-xl shadow-fuchsia-600/25 transition-all disabled:opacity-50"
        >
          {isProcessing ? "Processing Tip..." : `Pay $${(selectedAmount / 100).toFixed(2)} & Unlock Now`}
        </button>

        <p className="mt-3 text-center text-[11px] text-zinc-500">
          Discreet billing descriptor. 100% encrypted and adult-industry compliant.
        </p>
      </div>
    </div>
  );
}
