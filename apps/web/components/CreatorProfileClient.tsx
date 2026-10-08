"use client";

import React, { useState } from "react";
import { Sparkles, Check, Crown, Flame, Shield, Play, Lock, Film, Heart, Share2, Layers } from "lucide-react";
import { VideoCard, type VideoCardProps } from "@/components/VideoCard";
import { PlaylistCard, type PlaylistCardProps } from "@/components/PlaylistCard";
import { TipModal } from "@/components/TipModal";

interface CreatorProfileClientProps {
  creator: {
    id: string;
    username: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    totalViews: number;
    patrons: number;
    videosCount: number;
  };
  videos: VideoCardProps[];
  playlists: PlaylistCardProps[];
}

export function CreatorProfileClient({
  creator,
  videos,
  playlists,
}: CreatorProfileClientProps) {
  const [activeTab, setActiveTab] = useState<"all" | "ppv" | "playlists" | "about">("all");
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [subscribedToast, setSubscribedToast] = useState<string | null>(null);

  const tiers = [
    {
      id: 1,
      name: "Supporter Club",
      price: "$10",
      period: "/month",
      badge: "Patron",
      color: "border-violet-500/30 bg-violet-950/20",
      perks: [
        "Full access to creator feed posts",
        "Stream all public 4K releases",
        "Exclusive subscriber comment badge",
      ],
    },
    {
      id: 2,
      name: "VIP All-Access",
      price: "$25",
      period: "/month",
      badge: "Popular",
      color: "border-fuchsia-500/50 bg-gradient-to-b from-fuchsia-950/30 to-zinc-950/80 shadow-lg shadow-fuchsia-950/30",
      perks: [
        "Everything in Supporter Club",
        "Direct Messaging & Priority DM replies",
        "Exclusive 4K Uncut Master downloads",
        "15% Discount on all PPV exclusive streams",
      ],
    },
    {
      id: 3,
      name: "Sovereign Tier",
      price: "$75",
      period: "/month",
      badge: "Elite",
      color: "border-amber-500/40 bg-gradient-to-b from-amber-950/20 to-zinc-950/80",
      perks: [
        "Everything in VIP All-Access",
        "Custom stream dedication & shoutout",
        "Access to private 1-on-1 monthly live room",
        "All PPV content automatically unlocked",
      ],
    },
  ];

  const filteredVideos = activeTab === "ppv"
    ? videos.filter((v) => v.visibility === "TIPPED_UNLOCKED")
    : videos;

  const handleSubscribe = (tierName: string) => {
    setSubscribedToast(`🎉 Congratulations! You joined ${creator.displayName}'s ${tierName}!`);
    setTimeout(() => setSubscribedToast(null), 5000);
  };

  return (
    <div className="space-y-10">
      {/* Wishlist / Tip Goal Progress Bar */}
      <div className="rounded-3xl border border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-950/70 dark:bg-zinc-950/70 light:bg-white p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-fuchsia-400" />
              <h4 className="text-sm font-bold text-white dark:text-white light:text-slate-900">
                Current Goal: 4K Nocturnal Cinema Rig Upgrade
              </h4>
            </div>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500">
              Help fund the new ultra-low-light sensor for upcoming exclusive cinematic streams.
            </p>
          </div>
          <button
            onClick={() => setIsTipModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-105 active:scale-95 transition-all shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Contribute Tip</span>
          </button>
        </div>

        {/* Progress Bar Track */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 dark:text-zinc-400 light:text-slate-500 mb-1.5">
            <span className="text-emerald-400 font-bold">$2,450.00 raised</span>
            <span>$3,000.00 goal (81%)</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800 dark:bg-zinc-800 light:bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 transition-all duration-1000"
              style={{ width: "81%" }}
            />
          </div>
        </div>
      </div>

      {/* Subscription Tiers (OnlyFans / Fansly benchmark) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="h-5 w-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white dark:text-white light:text-slate-900">
            Subscription Perks & Tiers
          </h3>
        </div>

        {subscribedToast && (
          <div className="mb-4 rounded-2xl border border-emerald-500/40 bg-emerald-950/80 p-3 text-center text-xs font-bold text-emerald-300 animate-in zoom-in-95">
            {subscribedToast}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative flex flex-col justify-between rounded-3xl border p-6 transition-all duration-300 hover:scale-[1.02] ${tier.color} ${
                tier.badge === "Popular" ? "ring-2 ring-fuchsia-500/50" : ""
              }`}
            >
              {tier.badge === "Popular" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-md">
                  Most Popular
                </span>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white dark:text-white light:text-slate-900">{tier.name}</h4>
                  <span className="rounded-full bg-white/10 dark:bg-white/10 light:bg-black/10 px-2 py-0.5 text-[10px] font-mono text-zinc-300 dark:text-zinc-300 light:text-slate-700">
                    {tier.badge}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white dark:text-white light:text-slate-900">{tier.price}</span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500">{tier.period}</span>
                </div>

                <ul className="mt-5 space-y-2.5 text-xs text-zinc-300 dark:text-zinc-300 light:text-slate-700">
                  {tier.perks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleSubscribe(tier.name)}
                className="mt-6 w-full rounded-2xl bg-white/10 dark:bg-white/10 light:bg-black/5 hover:bg-violet-600 hover:text-white py-2.5 text-xs font-bold text-white dark:text-white light:text-slate-900 transition-all hover:shadow-lg active:scale-95"
              >
                Join {tier.name}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Media & Content Tabs */}
      <div>
        <div className="flex items-center gap-2 border-b border-white/10 dark:border-white/10 light:border-black/5 pb-3">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "all"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                : "text-zinc-400 dark:text-zinc-400 light:text-slate-600 hover:text-white"
            }`}
          >
            <Film className="h-3.5 w-3.5" />
            <span>All Streams ({videos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("ppv")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "ppv"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                : "text-zinc-400 dark:text-zinc-400 light:text-slate-600 hover:text-white"
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>PPV Exclusives</span>
          </button>

          {playlists.length > 0 && (
            <button
              onClick={() => setActiveTab("playlists")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === "playlists"
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-400 dark:text-zinc-400 light:text-slate-600 hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Series ({playlists.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab("about")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "about"
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                : "text-zinc-400 dark:text-zinc-400 light:text-slate-600 hover:text-white"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>2257 Vault & Lore</span>
          </button>
        </div>

        {/* Tab Content Display */}
        <div className="mt-6">
          {activeTab === "playlists" ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {playlists.map((p) => (
                <PlaylistCard key={p.id} {...p} />
              ))}
            </div>
          ) : activeTab === "about" ? (
            <div className="rounded-3xl border border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-950/60 dark:bg-zinc-950/60 light:bg-white p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/20 text-emerald-400">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white dark:text-white light:text-slate-900">
                    18 U.S.C. § 2257 Compliance Verification
                  </h4>
                  <p className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500">
                    Custodian of Records verified under federal adult record-keeping regulations.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-zinc-300 dark:text-zinc-300 light:text-slate-700 border-t border-white/5 dark:border-white/5 light:border-black/5 pt-4">
                <div>
                  <span className="text-zinc-500">Performer Legal Status:</span>
                  <p className="font-semibold text-white dark:text-white light:text-slate-900">18+ Age Verified (Government ID)</p>
                </div>
                <div>
                  <span className="text-zinc-500">Custodian of Records:</span>
                  <p className="font-semibold text-white dark:text-white light:text-slate-900">Orochia Sovereign Records Officer</p>
                </div>
                <div>
                  <span className="text-zinc-500">Platform Payout Rail:</span>
                  <p className="font-semibold text-emerald-400">Direct USDT-TRC20 & CCBill Settlement</p>
                </div>
                <div>
                  <span className="text-zinc-500">Content Integrity:</span>
                  <p className="font-semibold text-violet-400">SHA-256 HMAC Tokenized HLS Edge Delivery</p>
                </div>
              </div>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="rounded-3xl border border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50 p-12 text-center text-sm text-zinc-400">
              No videos in this section yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {filteredVideos.map((video) => (
                <VideoCard key={video.id} {...video} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tip Modal Trigger */}
      {videos.length > 0 && (
        <TipModal
          isOpen={isTipModalOpen}
          onClose={() => setIsTipModalOpen(false)}
          videoId={videos[0].id}
          creatorName={creator.displayName}
          minTipAmountCents={1000}
          onUnlockedSuccess={() => {
            setIsTipModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
