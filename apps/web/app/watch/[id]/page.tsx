"use client";

import React, { useEffect, useState } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { TipModal } from "@/components/TipModal";
import { ReportModal } from "@/components/ReportModal";
import { Sparkles, Eye, ShieldCheck, Share2, Flag } from "lucide-react";

export default function WatchPage({ params }: { params: { id: string } }) {
  const videoId = params.id;

  const [streamData, setStreamData] = useState<{
    allowed: boolean;
    streamUrl?: string;
    reason?: string;
    minTipAmountCents?: number;
    title?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const fetchStreamAccess = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/videos/${videoId}/stream`);
      const data = await res.json();
      setStreamData(data);
    } catch (err) {
      console.error("Stream access fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStreamAccess();
  }, [videoId]);

  // Demo fallback metadata for rendering UI
  const videoTitle =
    streamData?.title ||
    (videoId === "2d7f8c91-9921-4d30-b2aa-c819a5f255cc"
      ? "Velvet Lounge Private Session — 4K Uncut Director's Cut"
      : "Tokyo Neon Horizons — Episode 01: The Velvet Alley");

  const creatorName = "Elena Vox";
  const creatorBio =
    "Independent visual artist & director exploring late-night neon narratives. Supported 100% by direct fan tips.";
  const minTipAmountCents = streamData?.minTipAmountCents || 1000;
  const isPaywalled = streamData ? !streamData.allowed && streamData.reason === "PAYWALL_REQUIRED" : false;
  const isContactsOnly = streamData ? !streamData.allowed && streamData.reason === "CONTACTS_ONLY" : false;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Main Stream Section */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="aspect-video w-full rounded-2xl bg-zinc-900 animate-pulse flex items-center justify-center border border-white/5">
              <span className="text-xs text-zinc-500 font-mono">Verifying HMAC Token Auth...</span>
            </div>
          ) : (
            <VideoPlayer
              videoId={videoId}
              streamUrl={streamData?.streamUrl}
              posterUrl="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80"
              title={videoTitle}
              isPaywalled={isPaywalled}
              minTipAmountCents={minTipAmountCents}
              isContactsOnly={isContactsOnly}
              onUnlockRequested={() => setIsTipModalOpen(true)}
            />
          )}

          {/* Video Information Header */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-white">{videoTitle}</h1>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsTipModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/20 hover:from-violet-500 hover:to-fuchsia-500 transition-all hover:scale-105 active:scale-95"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Send Tip</span>
                </button>
                <button className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors">
                  <Share2 className="h-4 w-4" />
                  <span>Share</span>
                </button>
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>Report</span>
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-zinc-500" />
                3,140 views
              </span>
              <span>•</span>
              <span className="text-violet-400 font-semibold">Bunny.net 4K HLS</span>
              <span>•</span>
              <span>Published Oct 2026</span>
            </div>

            {/* Creator Profile Card */}
            <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-full border border-violet-500/30">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                    alt={creatorName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{creatorName}</span>
                    <ShieldCheck className="h-4 w-4 text-violet-400" />
                  </div>
                  <span className="text-xs text-zinc-400">14.2K community members</span>
                </div>
              </div>

              <button className="rounded-xl border border-white/10 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-white transition-all">
                Connect Contact
              </button>
            </div>

            <p className="mt-4 text-sm text-zinc-300 leading-relaxed bg-zinc-900/30 rounded-2xl p-4 border border-white/5">
              {creatorBio}
            </p>
          </div>
        </div>

        {/* Right Sidebar: Security, Gateways, and Suggested Streams */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
            <h3 className="text-sm font-bold text-white mb-3">Security & Monetization Architecture</h3>
            <ul className="space-y-2.5 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                <span>HMAC-SHA256 Expiring Playback Tokens prevent hotlinking & unauthorized RIPs.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 mt-1.5 shrink-0" />
                <span>Zero-trust IDOR evaluation verifies creator friendship / tip grants before signing media URLs.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>Adult-compliant processors (CCBill, Segpay, Crypto) ensure zero merchant bans.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-5">
            <h3 className="text-sm font-bold text-white mb-3">Recommended Streams</h3>
            <div className="space-y-3">
              <div className="flex gap-3 items-center group cursor-pointer">
                <div className="h-16 w-24 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                  <img
                    src="https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=200&q=80"
                    alt="Tokyo Neon"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-white group-hover:text-violet-400 line-clamp-1">
                    Tokyo Neon Horizons — Episode 01
                  </h4>
                  <span className="text-[11px] text-zinc-400">Elena Vox</span>
                  <span className="block text-[10px] text-zinc-500 font-mono">23:40 • Free Stream</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tip & Unlock Modal */}
      <TipModal
        isOpen={isTipModalOpen}
        onClose={() => setIsTipModalOpen(false)}
        videoId={videoId}
        creatorName={creatorName}
        minTipAmountCents={minTipAmountCents}
        onUnlockedSuccess={() => {
          fetchStreamAccess();
        }}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        videoId={videoId}
        videoTitle={videoTitle}
      />
    </div>
  );
}
