"use client";

import { Bitcoin, CheckCircle2,CreditCard, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useState } from "react";

import { Button, cn, Dialog, RadioGroup, Sheet } from "@/components/ui";
import { t } from "@/lib/i18n";
import { money } from "@/lib/money";

type Gateway = "CREDITS" | "CCBILL" | "SEGPAY" | "CRYPTO" | "STRIPE";
/** The ways to pay, in display order (only those the deployment offers are shown). */
const METHODS: { id: Gateway; icon: React.ElementType; tone: string }[] = [
  { id: "CREDITS", icon: Sparkles, tone: "text-accent" },
  { id: "CCBILL", icon: CreditCard, tone: "text-accent" },
  { id: "SEGPAY", icon: ShieldCheck, tone: "text-success" },
  { id: "STRIPE", icon: CreditCard, tone: "text-info" },
  { id: "CRYPTO", icon: Bitcoin, tone: "text-warning" },
];

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** What the payment is for: a video (an unlock) — or a story (a tip from it, `storyId`, no video). */
  videoId?: string;
  storyId?: string;
  creatorName: string;
  minTipAmountCents: number;
  onUnlockedSuccess: () => void;
}

export function TipModal({
  isOpen,
  onClose,
  videoId,
  storyId,
  creatorName,
  minTipAmountCents,
  onUnlockedSuccess,
}: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(
    storyId ? Math.max(500, minTipAmountCents) : Math.max(1000, minTipAmountCents)
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
      const res = storyId
        ? await fetch(`/api/stories/${storyId}/tip`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amountCents: selectedAmount, gateway: selectedGateway }),
          })
        : await fetch("/api/videos/unlock-video", {
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

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Sheet size="md">
        <Dialog.Header>
          <Dialog.Title>{t("payments.title", { name: creatorName })}</Dialog.Title>
          <Dialog.Description>{storyId ? t("payments.subtitleStory") : t("payments.subtitle")}</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body className="pt-3">
          {errorMsg && (
            <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              {errorMsg}
            </div>
          )}

          <div className="mb-5">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-fg-secondary">{t("payments.amount")}</span>
              {minTipAmountCents > 100 && <span className="text-[11px] text-fg-muted">{t("payments.minimum", { amount: money(minTipAmountCents) })}</span>}
            </div>
            <RadioGroup.Root label={t("payments.amount")} value={String(selectedAmount)} onValueChange={(v) => setSelectedAmount(Number(v))} className="grid grid-cols-4 gap-2">
              {presets.map((p) => (
                <RadioGroup.Card
                  key={p.cents}
                  value={String(p.cents)}
                  disabled={p.cents < minTipAmountCents}
                  className="items-center rounded-xl py-3 text-sm font-bold data-[state=checked]:bg-accent data-[state=checked]:text-on-accent data-[state=checked]:shadow-md data-[state=checked]:shadow-accent/30"
                >
                  {p.label}
                </RadioGroup.Card>
              ))}
            </RadioGroup.Root>
          </div>

          <span className="mb-2 block text-xs font-semibold text-fg-secondary">{t("payments.method")}</span>
          <RadioGroup.Root label={t("payments.method")} value={selectedGateway} onValueChange={(v) => setSelectedGateway(v as Gateway)} className="space-y-2">
            {METHODS.filter((m) => offers(m.id)).map(({ id, icon: Icon, tone }) => (
              <RadioGroup.Card key={id} value={id} className="group/method w-full flex-row items-center gap-3 rounded-2xl">
                <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2", tone)}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">{id === "CREDITS" ? t("payments.credits.title") : t(`payments.gateways.${id}.title`)}</span>
                  <span className="block text-xs text-fg-secondary">{id === "CREDITS" ? t("payments.credits.hint") : t(`payments.gateways.${id}.hint`)}</span>
                </span>
                <CheckCircle2 className="hidden h-5 w-5 shrink-0 text-accent group-data-[state=checked]/method:block" />
              </RadioGroup.Card>
            ))}
          </RadioGroup.Root>
        </Dialog.Body>
        <Dialog.Footer className="flex-col items-stretch gap-0">
          {creditsShort !== null && (
            <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning">
              <span>{t("wallet.short", { balance: money(creditsShort) })}</span>
              <Link href="/wallet" className="shrink-0 rounded-full bg-warning px-3 py-1.5 font-bold text-surface-0">
                {t("wallet.add")}
              </Link>
            </div>
          )}
          {unavailable && <p className="mb-3 text-xs text-warning">{t("payments.unavailable")}</p>}
          <Button variant="sensual" size="lg" shape="rounded" className="w-full" disabled={unavailable} loading={isProcessing} onClick={() => void handleProcessTip()}>
            {isProcessing ? t("payments.processing") : t("payments.pay", { amount: money(selectedAmount) })}
          </Button>
          <p className="mt-3 text-center text-[11px] text-fg-muted">{t("payments.discreet")}</p>
        </Dialog.Footer>
      </Sheet>
    </Dialog.Root>
  );
}
