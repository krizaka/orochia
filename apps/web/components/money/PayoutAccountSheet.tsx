"use client";

import React, { useState } from "react";
import { Lock } from "lucide-react";
import { Button, Segmented, Sheet } from "@/components/ui";
import { t, type MessageKey } from "@/lib/i18n";

const METHODS = ["BANK_IBAN", "BANK_US", "BANK_CA", "PAYPAL", "CRYPTO_USDT_TRC20", "CRYPTO_BTC"] as const;
type Method = (typeof METHODS)[number];

/** The fields each payout method asks for (validated again, and encrypted, by the server). */
const FIELDS: Record<Method, { key: string; inputMode?: "numeric" | "email" | "text"; autoComplete?: string }[]> = {
  BANK_IBAN: [{ key: "iban", autoComplete: "off" }, { key: "bic", autoComplete: "off" }],
  BANK_US: [{ key: "routingNumber", inputMode: "numeric" }, { key: "accountNumber", inputMode: "numeric" }],
  BANK_CA: [{ key: "transitNumber", inputMode: "numeric" }, { key: "institutionNumber", inputMode: "numeric" }, { key: "accountNumber", inputMode: "numeric" }],
  PAYPAL: [{ key: "email", inputMode: "email", autoComplete: "email" }],
  CRYPTO_USDT_TRC20: [{ key: "address", autoComplete: "off" }],
  CRYPTO_BTC: [{ key: "address", autoComplete: "off" }],
};
const DEFAULT_COUNTRY: Partial<Record<Method, string>> = { BANK_US: "US", BANK_CA: "CA" };

const label = "mb-1.5 block text-xs font-semibold text-zinc-300 light:text-slate-700";
const field =
  "w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-hidden light:border-black/10 light:bg-slate-50 light:text-slate-900";

/** Add or replace where earnings are sent. */
export function PayoutAccountSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [method, setMethod] = useState<Method>("BANK_IBAN");
  const [holderName, setHolderName] = useState("");
  const [country, setCountry] = useState("");
  const [details, setDetails] = useState<Record<string, string>>({ accountType: "checking" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/me/payout-account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, holderName, country: country || DEFAULT_COUNTRY[method] || "", details }),
    });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => ({}))) as { error?: string }).error || t("settings.failed"));
    setDetails({ accountType: "checking" });
    onSaved();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("earnings.account.title")}
      footer={
        <>
          <Button variant="primary" size="lg" round={false} className="w-full" loading={busy} onClick={() => void save()}>
            {t("earnings.account.save")}
          </Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <Lock className="h-3 w-3" /> {t("earnings.account.secure")}
          </p>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className={label}>{t("earnings.account.method")}</span>
          <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className={field}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {t(`earnings.account.methods.${m}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem]">
          <label className="block">
            <span className={label}>{t("earnings.account.holder")}</span>
            <input value={holderName} onChange={(e) => setHolderName(e.target.value)} autoComplete="name" className={field} />
            <span className="mt-1 block text-[11px] text-zinc-500">{t("earnings.account.holderHint")}</span>
          </label>
          <label className="block">
            <span className={label}>{t("earnings.account.country")}</span>
            <input
              value={country || DEFAULT_COUNTRY[method] || ""}
              onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="FR"
              autoComplete="country"
              maxLength={2}
              className={`${field} uppercase`}
            />
          </label>
        </div>
        {FIELDS[method].map((f) => (
          <label key={f.key} className="block">
            <span className={label}>{t(`earnings.account.fields.${f.key}` as MessageKey)}</span>
            <input
              value={details[f.key] ?? ""}
              onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })}
              inputMode={f.inputMode}
              autoComplete={f.autoComplete ?? "off"}
              spellCheck={false}
              className={`${field} font-mono`}
            />
          </label>
        ))}
        {method === "BANK_US" && (
          <Segmented
            label={t("earnings.account.fields.accountType")}
            value={details.accountType === "savings" ? "savings" : "checking"}
            onChange={(v) => setDetails({ ...details, accountType: v })}
            options={[
              { value: "checking", label: t("earnings.account.checking") },
              { value: "savings", label: t("earnings.account.savings") },
            ]}
          />
        )}
        {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 light:text-rose-700">{error}</p>}
      </div>
    </Sheet>
  );
}
