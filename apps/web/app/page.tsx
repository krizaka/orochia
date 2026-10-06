import React from "react";
import Link from "next/link";
import { VideoCard } from "@/components/VideoCard";
import { Flame, Shield, Sparkles, Tv, Lock, ArrowRight, LayoutDashboard, User, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  // Demo showcase videos matching seeded content
  const featuredVideos = [
    {
      id: "9b3c4a12-8819-4820-a6fe-b715a3e144bb",
      title: "Tokyo Neon Horizons — Episode 01: The Velvet Alley",
      creatorName: "Elena Vox",
      creatorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      thumbnailUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
      previewAnimationUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&q=80",
      durationSeconds: 1420,
      visibility: "PUBLIC" as const,
      minTipAmountCents: 0,
      viewsCount: 8940,
      tipsCount: 42,
    },
    {
      id: "2d7f8c91-9921-4d30-b2aa-c819a5f255cc",
      title: "Velvet Lounge Private Session — 4K Uncut Director's Cut",
      creatorName: "Elena Vox",
      creatorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      thumbnailUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
      previewAnimationUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80",
      durationSeconds: 2850,
      visibility: "TIPPED_UNLOCKED" as const,
      minTipAmountCents: 1000,
      viewsCount: 3100,
      tipsCount: 185,
    },
    {
      id: "3e8a9d02-1134-4e41-c3bb-d928b6e366dd",
      title: "Midnight Noir: Acoustic Lounge & Intimate Studio Session",
      creatorName: "Mia Sterling",
      creatorAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
      thumbnailUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
      previewAnimationUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=400&q=80",
      durationSeconds: 1980,
      visibility: "TIPPED_UNLOCKED" as const,
      minTipAmountCents: 500,
      viewsCount: 5210,
      tipsCount: 94,
    },
    {
      id: "4f9b0e13-2245-5f52-d4cc-e039c7f477ee",
      title: "Behind the Lens: Underground Berlin Rave Culture",
      creatorName: "Kaelen Drake",
      creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
      thumbnailUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80",
      previewAnimationUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80",
      durationSeconds: 1650,
      visibility: "CONTACTS_ONLY" as const,
      minTipAmountCents: 0,
      viewsCount: 2400,
      tipsCount: 18,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Hero Showcase Banner */}
      <div className="relative mb-12 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-violet-950/60 via-zinc-950 to-fuchsia-950/50 p-8 sm:p-12 shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300 mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Adult-Friendly Open-Source Creator Platform</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Independent Creators. <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              Zero Censorship.
            </span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-zinc-300 leading-relaxed">
            High-performance 4K HLS video streaming powered directly by Bunny.net Stream API.
            Direct creator tipping via adult-compliant payment processors (CCBill, Segpay, Crypto)
            with tokenized HMAC anti-hotlink paywalls.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/watch/2d7f8c91-9921-4d30-b2aa-c819a5f255cc"
              className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-fuchsia-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Tv className="h-4 w-4" />
              <span>Watch Tipped Showcase</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-violet-500/40 bg-violet-600/20 px-5 py-3 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-violet-600/30 shadow-md shadow-violet-600/20"
            >
              <LayoutDashboard className="h-4 w-4 text-violet-400" />
              <span>Mon Espace</span>
            </Link>
            <Link
              href="/creator/upload"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-zinc-900/80 px-5 py-3 text-xs sm:text-sm font-semibold text-white transition-all hover:bg-zinc-800"
            >
              <span>Creator Studio</span>
              <ArrowRight className="h-4 w-4 text-zinc-400" />
            </Link>
          </div>
        </div>

        {/* Decorative backdrop glow */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/4 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl pointer-events-none" />
      </div>

      {/* Feature Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900/40 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
            <Tv className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Bunny.net Stream</h4>
            <p className="text-xs text-zinc-400">Global edge 4K HLS & SHA-256 token security</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900/40 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-600/20 text-fuchsia-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Granular Paywalls</h4>
            <p className="text-xs text-zinc-400">Public, Contacts-Only, or Minimum Tip Unlocks</p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900/40 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-emerald-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Adult Gateways</h4>
            <p className="text-xs text-zinc-400">CCBill, Segpay, and USDT Crypto tipping</p>
          </div>
        </div>
      </div>

      {/* Featured Sovereign Creator Spotlight */}
      <div className="mb-12 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900/90 to-violet-950/40 p-6 sm:p-8 relative">
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-violet-500/60 shadow-xl shadow-violet-500/20">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
                alt="Elena Vox"
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300 mb-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span>Featured Sovereign Creator · 18 U.S.C. § 2257 Verified</span>
              </div>
              <h3 className="text-xl font-bold text-white">Elena Vox</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-lg leading-relaxed">
                Visual artist & nocturnal director exploring high-production 4K narrative streams.
                Directly funded by sovereign patrons with zero third-party payment censorship.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-mono text-zinc-400">
                <span><strong className="text-white">14.2K</strong> Patrons</span>
                <span><strong className="text-white">142.8K</strong> Views</span>
                <span><strong className="text-emerald-400">90%</strong> Net Creator Split</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0 w-full sm:w-auto">
            <Link
              href="/profile"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-105 transition-all"
            >
              <User className="h-4 w-4" />
              <span>View Creator Profile</span>
            </Link>
            <Link
              href="/auth/register"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-zinc-900/90 px-5 py-3 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <span>Join as Patron</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Video Grid Section */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-violet-400" />
          <h2 className="text-xl font-bold text-white">Trending Creator Streams</h2>
        </div>
        <span className="text-xs text-zinc-500 font-mono">Live on Bunny Edge CDN</span>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {featuredVideos.map((video) => (
          <VideoCard key={video.id} {...video} />
        ))}
      </div>
    </div>
  );
}
