"use client";

import React, { useSyncExternalStore } from "react";
import Link from "next/link";
import { ShieldAlert, CheckCircle, ExternalLink } from "lucide-react";
import { Button, OrochiaLogo } from "@/components/ui";
import { t } from "@/lib/i18n";
import { Rich } from "@/components/Rich";

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim-strong backdrop-blur-2xl kz-overlay">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 p-6 sm:p-8 shadow-2xl shadow-accent/40 text-center">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-accent/30 blur-3xl pointer-events-none" />

        {/* Brand Icon */}
        <OrochiaLogo size={88} className="mx-auto mb-3" />

        {/* Header */}
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent mb-3">
          <ShieldAlert className="h-3.5 w-3.5 text-accent" />
          <span>{t("ageGate.badge")}</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-display">
          {t("ageGate.title")}
        </h2>

        <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
          <Rich text={t("ageGate.body")} />
        </p>

        {/* Compliance Checklist */}
        <div className="my-6 space-y-2.5 rounded-2xl border border-white/5 bg-zinc-900/60 p-4 text-left text-xs text-fg-secondary">
          <div className="flex items-start gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
            <span>{t("ageGate.age")}</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
            <span>{t("ageGate.terms")}</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0 text-accent mt-0.5" />
            <span>{t("ageGate.consent")}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="sensual" size="lg" shape="rounded" onClick={handleConfirmAge} className="flex-1 rounded-xl px-6 font-bold">
            {t("ageGate.enter")}
          </Button>
          <Button variant="secondary" size="lg" shape="rounded" onClick={handleDecline} className="rounded-xl px-6">
            {t("ageGate.leave")}
          </Button>
        </div>

        {/* Legal Links */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-fg-muted">
          <Link href="/legal/terms" className="hover:text-zinc-300 transition-colors flex items-center gap-1">
            <span>{t("ageGate.termsLink")}</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
          <span>•</span>
          <Link href="/legal/privacy" className="hover:text-zinc-300 transition-colors flex items-center gap-1">
            <span>{t("ageGate.privacyLink")}</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
          <span>•</span>
          <Link href="/legal/2257" className="hover:text-zinc-300 transition-colors flex items-center gap-1">
            <span>{t("ageGate.noticeLink")}</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
