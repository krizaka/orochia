"use client";

import React, { useState } from "react";
import { Wallet, DollarSign, ArrowUpRight, ShieldCheck, History, CheckCircle2 } from "lucide-react";

export default function CreatorPayoutsPage() {
  const [payoutMethod, setPayoutMethod] = useState("CRYPTO_USDT");
  const [destination, setDestination] = useState("");
  const [amountDollars, setAmountDollars] = useState("500.00");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const availableBalance = 3150.0;
  const lifetimeEarnings = 14820.0;

  const handleSubmitPayout = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMsg(true);
    }, 1000);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20">
          <Wallet className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Creator Earnings & Payout Ledger</h1>
          <p className="text-xs text-zinc-400">
            Real-time double-entry escrow balances with adult-compliant automated disbursements
          </p>
        </div>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Available Escrow Balance
          </span>
          <div className="mt-2 text-3xl font-extrabold text-white">
            ${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Settled & ready for payout
          </span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Lifetime Tips Received
          </span>
          <div className="mt-2 text-3xl font-extrabold text-violet-400">
            ${lifetimeEarnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <span className="mt-2 block text-[11px] text-zinc-500 font-mono">
            350+ fan tip transactions
          </span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Platform Retained Fee
          </span>
          <div className="mt-2 text-3xl font-extrabold text-zinc-300">10.0%</div>
          <span className="mt-2 block text-[11px] text-zinc-500">
            Zero hidden merchant reserves
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Request Payout Form */}
        <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-2">Request Payout Disbursement</h2>
          <p className="text-xs text-zinc-400 mb-6">
            Disbursements processed within 24 business hours. Fully compliant with adult banking rails.
          </p>

          {successMsg ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400 mb-2" />
              <h3 className="text-sm font-bold text-white">Disbursement Initiated</h3>
              <p className="text-xs text-zinc-400 mt-1">
                Your payout request has been queued in the atomic ledger for automated settlement.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitPayout} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  Disbursement Rail
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="CRYPTO_USDT">USDT (TRC-20 / ERC-20 Crypto - Instant)</option>
                  <option value="CCBILL_DIRECT">CCBill Direct Creator Transfer</option>
                  <option value="SEGPAY_PAYOUT">Segpay Merchant Payout</option>
                  <option value="SEPA_EU">SEPA Direct Bank Wire (EU)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  Payout Amount ($ USD)
                </label>
                <input
                  type="number"
                  step="10.00"
                  max={availableBalance}
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  Destination Address / Account
                </label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. USDT TRC20 Wallet Address or Bank IBAN"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-fuchsia-600/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting Request..." : "Request Payout Now"}
              </button>
            </form>
          )}
        </div>

        {/* Ledger Transactions */}
        <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-bold text-white">Recent Ledger Transactions</h3>
          </div>

          <div className="space-y-3">
            {[
              { type: "TIP_RECEIVED", desc: "Velvet Lounge Private Tip", amount: "+$25.00", date: "Today" },
              { type: "TIP_RECEIVED", desc: "Tokyo Horizons Fan Tip", amount: "+$10.00", date: "Yesterday" },
              { type: "PAYOUT_COMPLETED", desc: "Disbursement to USDT TRC20", amount: "-$1,200.00", date: "Oct 02, 2026" },
              { type: "TIP_RECEIVED", desc: "Direct Video Unlock Tip", amount: "+$50.00", date: "Oct 01, 2026" },
            ].map((tx, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-zinc-900/40"
              >
                <div>
                  <div className="text-xs font-semibold text-white">{tx.desc}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">{tx.date}</div>
                </div>
                <div
                  className={`text-xs font-bold font-mono ${
                    tx.amount.startsWith("+") ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {tx.amount}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
