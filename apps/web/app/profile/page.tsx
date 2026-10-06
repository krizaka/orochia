"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { VideoCard } from "@/components/VideoCard";
import { TipModal } from "@/components/TipModal";
import {
  ShieldCheck,
  Sparkles,
  Users,
  Eye,
  Film,
  Lock,
  Calendar,
  Share2,
  CheckCircle2
} from "lucide-react";

export default function ProfilePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "unlocked" | "about">("all");
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Profile data (defaults to Elena Vox demo or active user)
  const creator = {
    displayName: user?.displayName || "Elena Vox",
    username: user?.username || "elenavox",
    role: "Sovereign Director & Producer",
    bio: user?.bio || "Visual artist, nocturnal producer & independent 4K cinema director. Creating uncensored narrative streams backed 100% by sovereign patrons on the Bunny.net global edge.",
    avatarUrl: user?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    bannerUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=80",
    followersCount: "14.2K",
    viewsCount: "142.8K",
    videosCount: 4,
    joinedDate: "October 2026",
    isVerified: true,
  };

  const creatorVideos = [
    {
      id: "9b3c4a12-8819-4820-a6fe-b715a3e144bb",
      title: "Tokyo Neon Horizons — Episode 01: The Velvet Alley",
      creatorName: creator.displayName,
      creatorAvatar: creator.avatarUrl,
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
      creatorName: creator.displayName,
      creatorAvatar: creator.avatarUrl,
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
      creatorName: creator.displayName,
      creatorAvatar: creator.avatarUrl,
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
      creatorName: creator.displayName,
      creatorAvatar: creator.avatarUrl,
      thumbnailUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80",
      previewAnimationUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=400&q=80",
      durationSeconds: 1650,
      visibility: "CONTACTS_ONLY" as const,
      minTipAmountCents: 0,
      viewsCount: 2400,
      tipsCount: 18,
    },
  ];

  const displayedVideos =
    activeTab === "unlocked"
      ? creatorVideos.filter((v) => v.visibility === "TIPPED_UNLOCKED")
      : creatorVideos;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Cinematic Banner */}
      <div className="relative h-64 sm:h-80 w-full overflow-hidden rounded-3xl border border-white/10 bg-zinc-950">
        <img
          src={creator.bannerUrl}
          alt="Profile Banner"
          className="h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
      </div>

      {/* Header Info */}
      <div className="relative px-4 sm:px-8 -mt-20 sm:-mt-24 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div className="flex items-end gap-5">
            <div className="relative h-28 w-28 sm:h-36 sm:w-36 overflow-hidden rounded-3xl border-4 border-zinc-950 bg-zinc-800 shadow-2xl">
              <img
                src={creator.avatarUrl}
                alt={creator.displayName}
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-2 right-2 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
            </div>

            <div className="mb-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-white font-display">
                  {creator.displayName}
                </h1>
                <ShieldCheck className="h-5 w-5 text-violet-400 fill-violet-400/20" />
              </div>
              <p className="text-xs text-zinc-400 font-mono">@{creator.username} • {creator.role}</p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsTipModalOpen(true)}
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 py-3.5 text-xs font-bold text-white shadow-xl shadow-fuchsia-600/25 hover:scale-105 active:scale-95 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              <span>Send Direct Tip</span>
            </button>

            <button
              onClick={() => setIsConnected(!isConnected)}
              className={`flex items-center gap-2 rounded-2xl border px-5 py-3.5 text-xs font-semibold transition-all ${
                isConnected
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>{isConnected ? "Connected Contact" : "Connect Contact"}</span>
            </button>

            <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-zinc-900 text-zinc-400 hover:text-white transition-colors">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Bio & Community Stats */}
        <div className="mt-6 max-w-3xl">
          <p className="text-sm text-zinc-300 leading-relaxed">{creator.bio}</p>

          <div className="mt-4 flex flex-wrap items-center gap-6 text-xs text-zinc-400 font-mono">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-violet-400" />
              <strong className="text-white font-semibold">{creator.followersCount}</strong> Patrons
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-fuchsia-400" />
              <strong className="text-white font-semibold">{creator.viewsCount}</strong> Total Views
            </span>
            <span className="flex items-center gap-1.5">
              <Film className="h-4 w-4 text-emerald-400" />
              <strong className="text-white font-semibold">{creator.videosCount}</strong> 4K Streams
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-zinc-500" />
              Joined {creator.joinedDate}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-white/5 pb-3 mb-8 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("all")}
          className={`rounded-xl px-4 py-2 transition-all ${
            activeTab === "all"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          All Streams ({creatorVideos.length})
        </button>
        <button
          onClick={() => setActiveTab("unlocked")}
          className={`rounded-xl px-4 py-2 transition-all ${
            activeTab === "unlocked"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          Exclusive Paywalled ({creatorVideos.filter((v) => v.visibility === "TIPPED_UNLOCKED").length})
        </button>
        <button
          onClick={() => setActiveTab("about")}
          className={`rounded-xl px-4 py-2 transition-all ${
            activeTab === "about"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
              : "text-zinc-400 hover:text-white hover:bg-zinc-900"
          }`}
        >
          About & 2257 Records
        </button>
      </div>

      {/* Content */}
      {activeTab === "about" ? (
        <div className="max-w-3xl glass-panel rounded-3xl p-8 space-y-6 text-sm text-zinc-300">
          <div>
            <h3 className="text-lg font-bold text-white font-display mb-2">Creator Sovereign Profile</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Elena Vox is an independent film director publishing high-bitrate adaptive HLS video content
              exclusively on the Orochia platform. All patronage flows directly to the creator without third-party corporate deductions.
            </p>
          </div>

          <div className="border-t border-white/5 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>18 U.S.C. § 2257 Record-Keeping Compliance</span>
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              All models and performers appearing in videos uploaded by this creator are verified to be at least 18 years of age.
              Records required pursuant to 18 U.S.C. § 2257 and 28 C.F.R. Part 75 are maintained by the records custodian of Elena Vox Media Productions.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {displayedVideos.map((video) => (
            <VideoCard key={video.id} {...video} />
          ))}
        </div>
      )}

      {/* Tip Modal */}
      <TipModal
        isOpen={isTipModalOpen}
        onClose={() => setIsTipModalOpen(false)}
        videoId="2d7f8c91-9921-4d30-b2aa-c819a5f255cc"
        creatorName={creator.displayName}
        minTipAmountCents={500}
        onUnlockedSuccess={() => {}}
      />
    </div>
  );
}
