"use client";

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
    minTipAmountCents?: number;
    totalTipsEarnedCents?: number;
    isVerified?: boolean;
  };
  videos: VideoCardProps[];
  playlists: PlaylistCardProps[];
}

export function CreatorProfileClient({
  creator,
  videos,
  playlists,
}: CreatorProfileClientProps) {
  // The open tab is in the address (?tab=…), so a link to it opens it.
  type ProfileTab = "all" | "ppv" | "playlists" | "about";
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = useSearchParams().get("tab");
  const activeTab: ProfileTab = tabParam === "ppv" || tabParam === "playlists" || tabParam === "about" ? tabParam : "all";
  const setActiveTab = (tab: ProfileTab) => router.replace(tab === "all" ? pathname : `${pathname}?tab=${tab}`, { scroll: false });
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);

  const filteredVideos = activeTab === "ppv"
    ? videos.filter((v) => v.visibility === "TIPPED_UNLOCKED")
    : videos;


  return (
    <div className="space-y-10">
      {/* Media & Content Tabs */}
      <div>
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto border-b border-white/10 px-4 pb-3 light:border-black/5 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${
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
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${
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
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${
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
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${
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
          minTipAmountCents={creator.minTipAmountCents || 500}
          onUnlockedSuccess={() => {
            setIsTipModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
