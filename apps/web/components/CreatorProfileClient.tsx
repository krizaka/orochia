"use client";

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Check, Crown, Flame, Shield, Play, Lock, Film, Heart, Share2, Layers } from "lucide-react";
import { VideoCard, type VideoCardProps } from "@/components/VideoCard";
import { PlaylistCard, type PlaylistCardProps } from "@/components/PlaylistCard";
import { TipModal } from "@/components/TipModal";
import { t } from "@/lib/i18n";

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
    /** A creator space (members have no 2257 verification to show). */
    isCreator?: boolean;
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
        <div role="tablist" className="-mx-4 flex items-center gap-2 overflow-x-auto border-b border-white/10 px-4 pb-3 light:border-black/5 sm:mx-0 sm:px-0">
          {(
            [
              { id: "all", icon: Film, label: t("profileTabs.all", { count: videos.length }) },
              { id: "ppv", icon: Lock, label: t("profileTabs.ppv") },
              ...(playlists.length > 0 ? [{ id: "playlists" as const, icon: Layers, label: t("profileTabs.playlists", { count: playlists.length }) }] : []),
              { id: "about", icon: Shield, label: t("profileTabs.about") },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === id
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white light:text-slate-600 hover:light:bg-black/5 hover:light:text-slate-950"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
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
            <div className="space-y-4 rounded-3xl border border-white/10 bg-zinc-950/60 p-6 light:border-black/5 light:bg-white sm:p-8">
              <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-300 light:text-slate-700">{creator.bio || t("profileTabs.noBio")}</p>
              {creator.isCreator && (
              <div className="flex items-start gap-3 border-t border-white/5 pt-4 light:border-black/5">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${creator.isVerified ? "bg-emerald-600/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
                  <Shield className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-sm font-bold text-white light:text-slate-900">{t(creator.isVerified ? "profileTabs.verifiedTitle" : "profileTabs.pendingTitle")}</h4>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-400 light:text-slate-500">{t(creator.isVerified ? "profileTabs.verifiedBody" : "profileTabs.pendingBody")}</p>
                </div>
              </div>
              )}
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="rounded-3xl border border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-900/40 dark:bg-zinc-900/40 light:bg-slate-50 p-12 text-center text-sm text-zinc-400">
              {t("profileTabs.empty")}
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
