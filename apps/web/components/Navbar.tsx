"use client";

import React from "react";
import Link from "next/link";
import { Flame, Film, Upload, Wallet, UserCheck, Shield } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 text-white shadow-lg shadow-violet-500/25">
            <Flame className="h-5 w-5 fill-white" />
          </div>
          <span className="text-lg font-black tracking-wider text-white">
            OROCHIA<span className="text-violet-400">.</span>
          </span>
          <span className="hidden sm:inline-block rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
            Open Source
          </span>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-zinc-300 hover:text-white transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/codex"
            className="text-sm font-medium text-zinc-300 hover:text-violet-400 transition-colors"
          >
            The Codex
          </Link>
          <Link
            href="/creator/payouts"
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <Wallet className="h-4 w-4 text-violet-400" />
            <span>Earnings</span>
          </Link>
        </nav>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/creator/upload"
            className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload</span>
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-300">
            <UserCheck className="h-4 w-4 text-emerald-400" />
          </div>
        </div>
      </div>
    </header>
  );
}
