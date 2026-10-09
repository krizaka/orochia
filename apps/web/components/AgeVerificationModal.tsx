"use client";

import { CheckCircle, ExternalLink,ShieldAlert } from "lucide-react";
import Link from "next/link";
import React, { useSyncExternalStore } from "react";

import { Rich } from "@/components/Rich";
import { Button, Dialog, OrochiaLogo } from "@/components/ui";
import { t } from "@/lib/i18n";

const AGE_KEY = "orochia_age_verified";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
// The gate stays closed on the server and until the browser says the visitor has not confirmed yet.
const readVerified = () => localStorage.getItem(AGE_KEY) !== null;

export function AgeVerificationModal() {
  const verified = useSyncExternalStore(subscribe, readVerified, () => true);
  const isOpen = !verified;

  const handleConfirmAge = () => {
    localStorage.setItem(AGE_KEY, "true");
    listeners.forEach((fn) => fn());
  };

  const handleDecline = () => {
    window.location.href = "https://www.google.com";
  };

  const legal = "flex items-center gap-1 transition-colors hover:text-fg";

  // Not dismissible: no Escape, no outside click, no close button — the visitor enters or leaves.
  return (
    <Dialog.Root open={isOpen}>
      <Dialog.Content
        size="lg"
        hideClose
        dismissible={false}
        className="max-w-lg overflow-y-auto rounded-3xl bg-surface-1 p-6 text-center shadow-2xl shadow-accent/30 sm:max-w-lg sm:p-8"
      >
        {/* Ambient top glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-accent/30 blur-3xl" aria-hidden />

        <OrochiaLogo size={88} className="mx-auto mb-3" />

        <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          <span>{t("ageGate.badge")}</span>
        </div>

        <Dialog.Title className="font-display text-2xl font-black tracking-tight sm:text-3xl">{t("ageGate.title")}</Dialog.Title>

        <Dialog.Description asChild>
          <p className="mt-3 text-sm leading-relaxed text-fg-secondary">
            <Rich text={t("ageGate.body")} />
          </p>
        </Dialog.Description>

        <ul className="my-6 space-y-2.5 rounded-2xl border border-border-subtle bg-surface-2 p-4 text-left text-xs text-fg-secondary">
          {(["age", "terms", "consent"] as const).map((key) => (
            <li key={key} className="flex items-start gap-2.5">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
              <span>{t(`ageGate.${key}`)}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="sensual" size="lg" shape="rounded" onClick={handleConfirmAge} className="flex-1 rounded-xl px-6 font-bold">
            {t("ageGate.enter")}
          </Button>
          <Button variant="secondary" size="lg" shape="rounded" onClick={handleDecline} className="rounded-xl px-6">
            {t("ageGate.leave")}
          </Button>
        </div>

        <nav className="mt-6 flex items-center justify-center gap-4 text-[11px] text-fg-muted">
          <Link href="/legal/terms" className={legal}>
            <span>{t("ageGate.termsLink")}</span>
            <ExternalLink className="h-2.5 w-2.5" aria-hidden />
          </Link>
          <span aria-hidden>•</span>
          <Link href="/legal/privacy" className={legal}>
            <span>{t("ageGate.privacyLink")}</span>
            <ExternalLink className="h-2.5 w-2.5" aria-hidden />
          </Link>
          <span aria-hidden>•</span>
          <Link href="/legal/2257" className={legal}>
            <span>{t("ageGate.noticeLink")}</span>
            <ExternalLink className="h-2.5 w-2.5" aria-hidden />
          </Link>
        </nav>
      </Dialog.Content>
    </Dialog.Root>
  );
}
