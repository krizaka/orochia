import React from "react";
import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";

export const metadata = { alternates: { canonical: "/legal/privacy" },
  title: "Privacy Policy — Orochia",
  description: "Privacy-first standards, zero surveillance advertising, and cryptographic data protection.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Orochia Sanctuary</span>
      </Link>

      <div className="mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 mb-4">
          <Lock className="h-3.5 w-3.5 text-violet-400" />
          <span>Privacy & Cryptographic Discretion</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-display">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Last Updated: October 6, 2026 • Designed for sovereign creators and privacy-conscious patrons.
        </p>
      </div>

      <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">1. Zero Surveillance Advertising</h2>
          <p>
            Orochia does not deploy third-party advertising trackers, cross-site behavioral telemetry, or data broker integrations. Your viewing habits, stream access records, and tipping activity are strictly private.
          </p>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">2. Cryptographic Token Protection</h2>
          <p>
            Stream playback requests generate short-lived (300-second) HMAC-SHA256 authenticated tokens. These tokens are bound to your active session and cannot be redistributed or hotlinked.
          </p>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">3. Payment Privacy & Crypto Tipping</h2>
          <p>
            For credit card payments, merchant transactions are processed via adult-compliant partners (CCBill, Segpay) using PCI-DSS Level 1 compliance. For cryptocurrency tipping (USDT, BTC), transactions occur directly on-chain or via non-custodial gateways without storing financial credentials on Orochia servers.
          </p>
        </section>
      </div>
    </div>
  );
}
