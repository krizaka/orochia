import React from "react";
import Link from "next/link";
import { Shield, ArrowLeft, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Terms of Service — Orochia",
  description: "Terms of Service, Performer Responsibilities, and Acceptable Use Policy for Orochia.",
};

export default function TermsPage() {
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
          <Shield className="h-3.5 w-3.5 text-violet-400" />
          <span>Legal & Regulatory Framework</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white font-display">
          Terms of Service & Community Covenant
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Effective Date: October 6, 2026 • Governing Protocol: Orochia Open-Source Platform
        </p>
      </div>

      <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">1. Age of Majority & Mandatory Eligibility</h2>
          <p>
            Orochia is an adult-friendly creator community platform. By accessing or publishing content on this site, you certify under penalty of perjury that:
          </p>
          <ul className="mt-3 list-disc list-inside space-y-1.5 text-zinc-400 pl-2">
            <li>You are at least eighteen (18) years of age, or the legal age of majority in your jurisdiction.</li>
            <li>You possess the legal right and authority to enter into this binding covenant.</li>
            <li>Viewing adult, sensual, or mature media is not prohibited in your local jurisdiction.</li>
          </ul>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">2. Creator Responsibilities & Content Standards</h2>
          <p>
            Independent creators retain full ownership of their media. However, creators must unconditionally agree to the following obligations upon upload:
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Strict 100% Consent Requirement:</strong> Every performer depicted in uploaded media must have provided affirmative, voluntary, written consent prior to recording.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">18 U.S.C. § 2257 Custody:</strong> Creators maintain full physical/digital records verifying the legal age of all performers at the time of creation.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Zero Non-Consensual Material (NCII):</strong> Any upload containing non-consensual imagery, deepfakes without license, or suspected underage individuals results in immediate permanent termination and reporting to relevant authorities (NCMEC).
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">3. Monetization, Tips & Double-Entry Ledger</h2>
          <p>
            Tipping and content unlocks are recorded in an immutable double-entry ledger. All transactions processed via CCBill, Segpay, or Cryptocurrency (USDT, BTC) are deemed final once media access has been cryptographic granted via signed token.
          </p>
        </section>

        <section className="glass-panel rounded-2xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-white mb-3 font-display">4. DMCA & Copyright Safe Harbor</h2>
          <p>
            Orochia operates under the provisions of the Digital Millennium Copyright Act (17 U.S.C. § 512). Copyright holders may submit expedited takedown notices via our dedicated <Link href="/legal/dmca" className="text-violet-400 underline">DMCA Policy</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
