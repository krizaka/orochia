"use client";

import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button, Chip, Sheet } from "@/components/ui";
import { usd } from "./format";
import { t } from "@/lib/i18n";

const MIN = 2000;

/** Withdraw earnings to the saved payout method: amount (quick picks or free), destination, confirmation. */
export function WithdrawSheet({ open, onClose, availableCents, destinationHint, onDone }: { open: boolean; onClose: () => void; availableCents: number; destinationHint: string; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const cents = Math.round(Number(amount.replace(",", ".")) * 100) || 0;
  const valid = cents >= MIN && cents <= availableCents;

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/creator/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents: cents }) });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; details?: { fieldErrors?: Record<string, string[]> } };
      return setError(Object.values(data.details?.fieldErrors ?? {})[0]?.[0] ?? data.error ?? t("settings.failed"));
    }
    setDone(true);
    onDone();
  };
  const close = () => {
    setDone(false);
    setAmount("");
    setError(null);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t("earnings.request.title")}
      footer={
        !done && (
          <Button variant="primary" size="lg" round={false} className="w-full" disabled={!valid} loading={busy} onClick={() => void submit()}>
            {t("earnings.request.submit", { amount: usd(cents) })}
          </Button>
        )
      }
    >
      {done ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <p className="mt-3 text-sm text-zinc-300 light:text-slate-700">{t("earnings.request.done")}</p>
        </div>
      ) : availableCents < MIN ? (
        <p className="py-4 text-sm text-zinc-400 light:text-slate-600">{t("earnings.request.tooLow")}</p>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-zinc-300 light:text-slate-700">{t("earnings.request.amount")}</span>
            <span className="flex items-center rounded-2xl border border-white/10 bg-zinc-900 px-4 focus-within:border-violet-500 light:border-black/10 light:bg-slate-50">
              <span className="font-display text-2xl font-black text-zinc-500">$</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                inputMode="decimal"
                placeholder="0.00"
                aria-describedby="withdraw-hint"
                className="w-full bg-transparent px-2 py-3 font-display text-2xl font-black text-white outline-hidden light:text-slate-900"
              />
            </span>
            <span id="withdraw-hint" className="mt-1 block text-[11px] text-zinc-500">{t("earnings.request.min")}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[0.25, 0.5, 1].map((share) => {
              const value = Math.floor((availableCents * share) / 100) * 100;
              if (value < MIN) return null;
              return (
                <Chip key={share} active={cents === value} onClick={() => setAmount((value / 100).toFixed(2))}>
                  {share === 1 ? t("earnings.request.max", { amount: usd(value) }) : usd(value)}
                </Chip>
              );
            })}
          </div>
          <p className="rounded-2xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-zinc-300 light:border-black/10 light:bg-black/2 light:text-slate-700">{t("earnings.request.to", { hint: destinationHint })}</p>
          {error && <p role="alert" className="text-xs text-rose-400 light:text-rose-600">{error}</p>}
        </div>
      )}
    </Sheet>
  );
}
