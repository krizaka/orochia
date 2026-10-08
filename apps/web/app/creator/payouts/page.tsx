"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Wallet, History, CheckCircle2 } from "lucide-react";

interface PayoutSummary {
  availableCents: number;
  lifetimeNetCents: number;
  creditsCount: number;
  platformFeePercent: number;
  history: { id: string; amountCents: number; status: string; payoutMethod: string; createdAt: string }[];
}

export default function CreatorPayoutsPage() {
  const [payoutMethod, setPayoutMethod] = useState("CRYPTO_USDT");
  const [destination, setDestination] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/creator/payouts", { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      setError("Payouts are available to creator accounts only.");
      return;
    }
    if (res.ok) setSummary(((await res.json()) as { data: PayoutSummary }).data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const availableBalance = (summary?.availableCents ?? 0) / 100;
  const lifetimeEarnings = (summary?.lifetimeNetCents ?? 0) / 100;

  const handleSubmitPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/creator/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: Math.round(parseFloat(amountDollars || "0") * 100),
          payoutMethod,
          payoutDestination: destination,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Payout request failed");
      setSuccessMsg(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payout request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/20">
          <Wallet className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white light:text-slate-900">Creator Earnings & Payout Ledger</h1>
          <p className="text-xs text-zinc-400 light:text-slate-500">
            Real-time double-entry escrow balances with adult-compliant automated disbursements
          </p>
        </div>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl light:bg-slate-50 light:border-black/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">
            Available Escrow Balance
          </span>
          <div className="mt-2 text-3xl font-extrabold text-white light:text-slate-900">
            ${availableBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Settled & ready for payout
          </span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl light:bg-slate-50 light:border-black/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">
            Lifetime Tips Received
          </span>
          <div className="mt-2 text-3xl font-extrabold text-violet-400">
            ${lifetimeEarnings.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <span className="mt-2 block text-[11px] text-zinc-500 font-mono light:text-slate-500">
            {summary?.creditsCount ?? 0} payments received
          </span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-zinc-900/60 p-6 shadow-xl light:bg-slate-50 light:border-black/10">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">
            Platform Retained Fee
          </span>
          <div className="mt-2 text-3xl font-extrabold text-zinc-300 light:text-slate-700">{(summary?.platformFeePercent ?? 0).toFixed(1)}%</div>
          <span className="mt-2 block text-[11px] text-zinc-500 light:text-slate-500">
            Deducted from each payment received
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Request Payout Form */}
        <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl light:bg-white light:border-black/10">
          <h2 className="text-lg font-bold text-white mb-2 light:text-slate-900">Request Payout Disbursement</h2>
          <p className="text-xs text-zinc-400 mb-6 light:text-slate-500">
            Requests are reviewed by the platform before settlement; the amount is reserved immediately.
          </p>

          {successMsg ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400 mb-2" />
              <h3 className="text-sm font-bold text-white light:text-slate-900">Disbursement Initiated</h3>
              <p className="text-xs text-zinc-400 mt-1 light:text-slate-500">
                Your payout request is recorded and the amount is reserved until it is settled.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmitPayout} className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block light:text-slate-500">
                  Disbursement Rail
                </label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
                >
                  <option value="CRYPTO_USDT">USDT (TRC-20 / ERC-20 Crypto - Instant)</option>
                  <option value="CCBILL_DIRECT">CCBill Direct Creator Transfer</option>
                  <option value="SEGPAY_PAYOUT">Segpay Merchant Payout</option>
                  <option value="SEPA_EU">SEPA Direct Bank Wire (EU)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block light:text-slate-500">
                  Payout Amount ($ USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="10"
                  max={availableBalance}
                  value={amountDollars}
                  onChange={(e) => setAmountDollars(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 block light:text-slate-500">
                  Destination Address / Account
                </label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. USDT TRC20 Wallet Address or Bank IBAN"
                  className="w-full rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>
              )}
              <button
                type="submit"
                disabled={isSubmitting || availableBalance < 10}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 text-white font-bold text-sm shadow-xl shadow-fuchsia-600/25 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? "Submitting Request..." : "Request Payout Now"}
              </button>
            </form>
          )}
        </div>

        {/* Ledger Transactions */}
        <div className="rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl light:bg-white light:border-black/10">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-bold text-white light:text-slate-900">Payout requests</h3>
          </div>

          <div className="space-y-3">
            {(summary?.history ?? []).length === 0 && (
              <p className="text-xs text-zinc-500 light:text-slate-500">No payout requested yet.</p>
            )}
            {(summary?.history ?? []).map((payout) => (
              <div key={payout.id} className="flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-zinc-900/40 light:bg-slate-50 light:border-black/10">
                <div>
                  <div className="text-xs font-semibold text-white light:text-slate-900">{payout.payoutMethod.replace(/_/g, " ")}</div>
                  <div className="text-[10px] text-zinc-500 font-mono light:text-slate-500">
                    {new Date(payout.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} • {payout.status.replace(/_/g, " ").toLowerCase()}
                  </div>
                </div>
                <div className={`text-xs font-bold font-mono ${payout.status === "FAILED" ? "text-zinc-500 line-through light:text-slate-500" : "text-rose-400"}`}>
                  -${(payout.amountCents / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
