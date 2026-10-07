import React from "react";
import Link from "next/link";
import { VideoCard } from "@/components/VideoCard";
import { RelationshipActions } from "@/components/RelationshipActions";
import { listFeed, featuredCreator } from "@/lib/queries";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";
import { Flame, Shield, Sparkles, Tv, Lock, ArrowRight, LayoutDashboard, User, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

async function loadHome() {
  try {
    const [videos, featured] = await Promise.all([listFeed(12), featuredCreator()]);
    return { videos, featured };
  } catch (error) {
    console.error("[home] feed unavailable:", error);
    return { videos: [], featured: null };
  }
}

export default async function HomePage() {
  const { videos: featuredVideos, featured } = await loadHome();
  const showcase = featuredVideos[0];

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
{showcase && (
            <Link
              href={`/watch/${showcase.id}`}
              className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-5 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-fuchsia-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Tv className="h-4 w-4" />
              <span>Watch the latest stream</span>
            </Link>
            )}
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

      {/* Featured creator spotlight (top earner) */}
      {featured && (
      <div className="mb-12 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950 via-zinc-900/90 to-violet-950/40 p-6 sm:p-8 relative">
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-violet-500/60 shadow-xl shadow-violet-500/20">
              <img
                src={featured.avatarUrl || AVATAR_PLACEHOLDER}
                alt={featured.displayName}
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-1 right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300 mb-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                <span>Featured Creator · 18 U.S.C. § 2257 Verified</span>
              </div>
              <h3 className="text-xl font-bold text-white">{featured.displayName}</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-lg leading-relaxed">
                {featured.bio || "Independent creator on Orochia."}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-mono text-zinc-400">
                <span><strong className="text-white">{featured.patrons.toLocaleString("en-US")}</strong> Patrons</span>
                <span><strong className="text-white">{featured.totalViews.toLocaleString("en-US")}</strong> Views</span>
                <span><strong className="text-white">{featured.videosCount}</strong> Videos</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3 shrink-0 w-full sm:w-auto">
            <Link
              href={`/creators/${featured.username}`}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-105 transition-all"
            >
              <User className="h-4 w-4" />
              <span>View Creator Profile</span>
            </Link>
            <RelationshipActions username={featured.username} show={["follow"]} />
          </div>
        </div>
      </div>
      )}

      {/* Video Grid Section */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-violet-400" />
          <h2 className="text-xl font-bold text-white">Latest Creator Streams</h2>
        </div>
        <span className="text-xs text-zinc-500 font-mono">Newest first</span>
      </div>

      {featuredVideos.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-12 text-center">
          <p className="text-sm font-semibold text-white">No streams published yet.</p>
          <p className="mt-1 text-xs text-zinc-400">Verified creators&apos; videos appear here as soon as they finish encoding.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featuredVideos.map((video) => (
            <VideoCard key={video.id} {...video} />
          ))}
        </div>
      )}
    </div>
  );
}
