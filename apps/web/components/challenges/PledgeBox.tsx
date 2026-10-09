"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Coins, Lock, Wallet } from "lucide-react";
import { Button, Chip, Input, orochiaButton } from "@/components/ui";
import { money } from "@/lib/money";
import { t, type MessageKey } from "@/lib/i18n";
import type { ChallengeView } from "@/lib/challenges";

/** Sends a JSON POST and returns the parsed answer, whatever the status (`ok` tells them apart). */
export async function postJson(url: string, body?: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  const data = ((await res?.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  return { ok: Boolean(res?.ok), data };
}

export function errorText(data: Record<string, unknown>): string {
  if (data.code === "INSUFFICIENT_CREDITS")
    return t("challenge.errors.INSUFFICIENT_CREDITS_BALANCE", {
      balance: money(Number(data.balance ?? 0)),
    });
  return data.code ? t(`challenge.errors.${String(data.code)}` as MessageKey) : t("challenge.errors.generic");
}

/**
 * Backing a challenge: one-tap amounts or a custom one, paid in credits and held until the creator delivers — given
 * back if it does not happen. Shows what the viewer already put in and their balance; a visitor is asked to sign in.
 */
export function PledgeBox({ c, onPledged }: { c: ChallengeView; onPledged: (balanceCents: number) => void }) {
  const [amount, setAmount] = useState<number>(c.suggestedPledgesCents[1] ?? 10_00);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = custom ? Math.round(Number(custom) * 100) : amount;

  if (!c.viewer.signedIn) {
    return (
      <div className="rounded-2xl border border-border-default p-4 text-center">
        <p className="text-sm text-fg-secondary">{t("challenge.pledge.signIn")}</p>
        <Link href={`/auth/login?next=/challenges/${c.id}`} className={orochiaButton({ variant: "sensual", shape: "pill", className: "mt-3" })}>
          {t("challenge.pledge.signInCta")}
        </Link>
      </div>
    );
  }

  const pledge = async () => {
    setBusy(true);
    setError(null);
    const { ok, data } = await postJson(`/api/challenges/${c.id}/pledges`, {
      amountCents: cents,
    });
    setBusy(false);
    if (ok) {
      setCustom("");
      onPledged(Number(data.balanceCents ?? 0));
    } else setError(errorText(data));
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border-default p-4">
      <p className="text-sm font-bold text-fg">{t(c.kind === "GOAL" ? "challenge.pledge.titleGoal" : "challenge.pledge.titlePot")}</p>
      <div className="flex flex-wrap gap-2">
        {c.suggestedPledgesCents.map((s) => (
          <Chip
            key={s}
            type="button"
            active={!custom && amount === s}
            onClick={() => {
              setAmount(s);
              setCustom("");
            }}
          >
            {money(s)}
          </Chip>
        ))}
        <span className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-fg-muted">$</span>
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            type="number"
            inputMode="decimal"
            min={1}
            aria-label={t("challenge.pledge.custom")}
            placeholder={t("challenge.pledge.custom")}
            className="w-28 rounded-full bg-transparent py-1.5 pl-6 pr-3 font-mono text-xs"
          />
        </span>
      </div>
      <Button
        variant="sensual"
        className="w-full"
        loading={busy}
        disabled={!(cents >= c.minimumPledgeCents)}
        onClick={pledge}>
        <Coins className="h-4 w-4" aria-hidden />
        {t("challenge.pledge.submit", { amount: money(Math.max(cents || 0, 0)) })}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}{" "}
          {error && c.viewer.balanceCents !== null && (
            <Link href="/wallet" className="font-semibold underline">
              {t("challenge.pledge.topUp")}
            </Link>
          )}
        </p>
      )}
      <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <Lock className="h-3 w-3" aria-hidden /> {t("challenge.pledge.held")}
        </span>
        {c.viewer.balanceCents !== null && (
          <span className="inline-flex items-center gap-1">
            <Wallet className="h-3 w-3" aria-hidden />{" "}
            {t("challenge.pledge.balance", {
              balance: money(c.viewer.balanceCents),
            })}
          </span>
        )}
      </p>
      {c.viewer.pledgedCents > 0 && (
        <p className="text-xs font-semibold text-success">{t("challenge.pledge.yours", { amount: money(c.viewer.pledgedCents) })}</p>
      )}
    </div>
  );
}
