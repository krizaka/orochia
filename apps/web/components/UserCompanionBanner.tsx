"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, ShieldCheck, Zap, Lock, X, ArrowRight, Compass, UserPlus } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function UserCompanionBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const isDismissed = localStorage.getItem("orochia-companion-dismissed");
    if (!isDismissed) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("orochia-companion-dismissed", "true");
  };

  if (dismissed) return null;

  return (
    <div className="relative mb-10 overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-r from-violet-950/40 via-zinc-900/60 to-fuchsia-950/30 dark:from-violet-950/40 dark:via-zinc-900/60 dark:to-fuchsia-950/30 light:from-violet-50 light:via-white light:to-fuchsia-50 p-6 sm:p-8 backdrop-blur-xl shadow-xl transition-all animate-in fade-in slide-in-from-top-4 duration-300">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss guide"
        className="absolute top-4 right-4 text-zinc-400 hover:text-white dark:hover:text-white light:hover:text-black p-1 rounded-xl transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 dark:text-violet-300 light:text-violet-700 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span>Sovereign Creator Architecture</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white dark:text-white light:text-slate-900 font-display">
            The adult platform where creators own their audience and revenue.
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-zinc-300 dark:text-zinc-300 light:text-slate-600 leading-relaxed">
            Unlike legacy centralized platforms that extract 20-30% fees and deplatform artists without recourse, 
            Orochia guarantees <strong>90% net revenue</strong>, direct crypto and adult processing rails, 
            and tamper-proof 18 U.S.C. § 2257 custodian compliance.
          </p>

          {/* Core Pillars */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700">
              <Zap className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>90% Payout Rate</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>2257 Verified</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700">
              <Lock className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />
              <span>Anti-Hotlink HLS</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-300 dark:text-zinc-300 light:text-slate-700">
              <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
              <span>Zero Deplatforming</span>
            </div>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto">
          {!user && (
            <Link
              href="/auth/register"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-105 active:scale-95 transition-all"
            >
              <UserPlus className="h-4 w-4" />
              <span>Become a Creator</span>
            </Link>
          )}
          <Link
            href="/explore"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/80 dark:bg-zinc-900/80 light:bg-slate-100 px-5 py-3 text-xs font-semibold text-zinc-200 dark:text-zinc-200 light:text-slate-800 hover:border-violet-500 transition-all"
          >
            <Compass className="h-4 w-4 text-violet-400" />
            <span>Explore All Streams</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
