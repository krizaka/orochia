"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, CheckCircle, ExternalLink, Flame } from "lucide-react";

export function AgeVerificationModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if user has already confirmed age
    const verified = localStorage.getItem("orochia_age_verified");
    if (!verified) {
      setIsOpen(true);
    }
  }, []);

  const handleConfirmAge = () => {
    localStorage.setItem("orochia_age_verified", "true");
    setIsOpen(false);
  };

  const handleDecline = () => {
    window.location.href = "https://www.google.com";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-zinc-950 p-6 sm:p-8 shadow-2xl shadow-violet-950/40 text-center">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full bg-violet-600/30 blur-3xl pointer-events-none" />

        {/* Brand Icon */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 shadow-lg shadow-violet-600/30">
          <Flame className="h-7 w-7 text-white fill-white" />
        </div>

        {/* Header */}
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 mb-3">
          <ShieldAlert className="h-3.5 w-3.5 text-violet-400" />
          <span>Age Verification & Compliance Gate</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-display">
          Welcome to Orochia
        </h2>

        <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
          Orochia is an open-source video and creator community platform that contains{" "}
          <strong className="text-white font-semibold">adult-friendly, mature, and unrestricted media</strong>.
          Access is strictly restricted to adults of legal age in their respective jurisdiction.
        </p>

        {/* Compliance Checklist */}
        <div className="my-6 space-y-2.5 rounded-2xl border border-white/5 bg-zinc-900/60 p-4 text-left text-xs text-zinc-400">
          <div className="flex items-start gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0 text-violet-400 mt-0.5" />
            <span>I certify under penalty of perjury that I am at least 18 years old (or the legal age of majority).</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0 text-violet-400 mt-0.5" />
            <span>I agree to Orochia&apos;s Terms of Service and 18 U.S.C. § 2257 Record-Keeping compliance standards.</span>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle className="h-4 w-4 shrink-0 text-violet-400 mt-0.5" />
            <span>I consent to viewing adult-oriented digital content created by independent performers.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleConfirmAge}
            className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 py-3.5 px-6 text-sm font-bold text-white shadow-lg shadow-violet-600/25 transition-all hover:scale-[1.02] active:scale-95"
          >
            I am 18 or Older — Enter Sanctuary
          </button>
          <button
            onClick={handleDecline}
            className="rounded-xl border border-white/10 bg-zinc-900 py-3.5 px-6 text-sm font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
          >
            Exit Site
          </button>
        </div>

        {/* Legal Links */}
        <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-zinc-500">
          <Link href="/legal/terms" className="hover:text-zinc-300 transition-colors flex items-center gap-1">
            <span>Terms of Service</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
          <span>•</span>
          <Link href="/legal/privacy" className="hover:text-zinc-300 transition-colors flex items-center gap-1">
            <span>Privacy Policy</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
          <span>•</span>
          <Link href="/legal/2257" className="hover:text-zinc-300 transition-colors flex items-center gap-1">
            <span>2257 Notice</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
