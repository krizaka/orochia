"use client";

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Check, Crown, Flame, Shield, Play, Lock, Film, Heart, Share2, Layers } from "lucide-react";
import { VideoCard, type VideoCardProps } from "@/components/VideoCard";
import { PlaylistCard, type PlaylistCardProps } from "@/components/PlaylistCard";
import { TipModal } from "@/components/TipModal";
import { t } from "@/lib/i18n";
import { cn, Tabs } from "@/components/ui";

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


  const tabs = [
    { id: "all", icon: Film, label: t("profileTabs.all", { count: videos.length }) },
    { id: "ppv", icon: Lock, label: t("profileTabs.ppv") },
    ...(playlists.length > 0 ? [{ id: "playlists" as const, icon: Layers, label: t("profileTabs.playlists", { count: playlists.length }) }] : []),
    { id: "about", icon: Shield, label: t("profileTabs.about") },
  ] as const;

  return (
    <div className="space-y-10">
      {/* Media & Content Tabs */}
      <div>
        <Tabs.Root value={activeTab} onValueChange={(tab) => setActiveTab(tab as ProfileTab)}>
          <Tabs.List aria-label={t("profileTabs.label")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {tabs.map(({ id, icon: Icon, label }) => (
              <Tabs.Trigger key={id} value={id} className="text-xs font-bold">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span>{label}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          {/* Tab Content Display: one panel per tab, the open one filled */}
          {tabs.map(({ id }) => (
            <Tabs.Content key={id} value={id} className="mt-2">
              {activeTab === id && (
                <>
              {activeTab === "playlists" ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {playlists.map((p) => (
                    <PlaylistCard key={p.id} {...p} />
                  ))}
                </div>
              ) : activeTab === "about" ? (
                <div className="space-y-4 rounded-3xl border border-border-default bg-surface-1/60 p-6 sm:p-8">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-fg-secondary">{creator.bio || t("profileTabs.noBio")}</p>
                  {creator.isCreator && (
                  <div className="flex items-start gap-3 border-t border-border-subtle pt-4">
                    <span className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      creator.isVerified ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                    )}>
                      <Shield className="h-5 w-5" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-fg">{t(creator.isVerified ? "profileTabs.verifiedTitle" : "profileTabs.pendingTitle")}</h4>
                      <p className="mt-0.5 text-xs leading-relaxed text-fg-secondary">{t(creator.isVerified ? "profileTabs.verifiedBody" : "profileTabs.pendingBody")}</p>
                    </div>
                  </div>
                  )}
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="rounded-3xl border border-border-default bg-surface-2/40 p-12 text-center text-sm text-fg-secondary">
                  {t("profileTabs.empty")}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {filteredVideos.map((video) => (
                    <VideoCard key={video.id} {...video} />
                  ))}
                </div>
              )}
                </>
              )}
            </Tabs.Content>
          ))}
        </Tabs.Root>
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
