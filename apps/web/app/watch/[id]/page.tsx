"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { VideoPlayer } from "@/components/VideoPlayer";
import { TipModal } from "@/components/TipModal";
import { ReportModal } from "@/components/ReportModal";
import { RelationshipActions } from "@/components/RelationshipActions";
import { SaveToPlaylist } from "@/components/SaveToPlaylist";
import { VideoComments } from "@/components/VideoComments";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { Sparkles, Eye, ShieldCheck, Share2, Flag, CheckCircle2, Heart, MessageSquare } from "lucide-react";

interface StreamAccess {
  allowed: boolean;
  streamUrl?: string;
  reason?: string;
  minTipAmountCents?: number;
}

interface RelatedVideo {
  id: string;
  title: string;
  creatorName: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  visibility: string;
}

interface VideoDetails {
  id: string;
  title: string;
  description: string | null;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string | null;
  creatorBio: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
  visibility: string;
  minTipAmountCents: number;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  commentsEnabled: boolean;
  createdAt: string;
  moreFromCreator: RelatedVideo[];
}

const formatDuration = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

export default function WatchPage() {
  const { id: videoId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const paymentState = searchParams.get("payment");

  const [details, setDetails] = useState<VideoDetails | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [stream, setStream] = useState<StreamAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const { user } = useAuth();

  const fetchStreamAccess = useCallback(async () => {
    try {
      const res = await fetch(`/api/videos/${videoId}/stream`, { cache: "no-store" });
      setStream((await res.json()) as StreamAccess);
    } catch {
      setStream({ allowed: false });
    }
  }, [videoId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      const res = await fetch(`/api/videos/${videoId}/details`, { cache: "no-store" });
      if (cancelled) return;
      if (res.status === 404) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }
      const data = (await res.json()) as { video?: VideoDetails; liked?: boolean };
      setDetails(data.video ?? null);
      setLiked(Boolean(data.liked));
      await fetchStreamAccess();
      if (!cancelled) setIsLoading(false);
    })().catch(() => setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [videoId, fetchStreamAccess]);

  // Back from the gateway: the webhook may land a few seconds after the redirect.
  useEffect(() => {
    if (paymentState !== "success") return;
    const timer = setInterval(() => void fetchStreamAccess(), 3000);
    const stop = setTimeout(() => clearInterval(timer), 30000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [paymentState, fetchStreamAccess]);

  // A share is counted once the link was handed over; the link still enforces the video's access.
  const share = async () => {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share) await navigator.share({ title: details?.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      void fetch(`/api/videos/${videoId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "LINK" }),
      });
    } catch {
      /* dismissed */
    }
  };

  const toggleLike = async () => {
    if (likeBusy) return;
    setLikeBusy(true);
    const res = await fetch(`/api/videos/${videoId}/like`, { method: liked ? "DELETE" : "POST" });
    if (res.ok) {
      const data = (await res.json()) as { liked: boolean; likesCount: number };
      setLiked(data.liked);
      setDetails((d) => (d ? { ...d, likesCount: data.likesCount } : d));
    }
    setLikeBusy(false);
  };

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-white font-display">Video not found</h1>
        <p className="mt-2 text-sm text-zinc-400">It may have been removed by its creator.</p>
        <Link href="/" className="mt-6 inline-block rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-bold text-white">
          Back to the feed
        </Link>
      </div>
    );
  }

  const title = details?.title ?? "";
  const minTipAmountCents = stream?.minTipAmountCents ?? details?.minTipAmountCents ?? 0;
  const isPaywalled = stream ? !stream.allowed && stream.reason === "PAYWALL_REQUIRED" : false;
  const isContactsOnly = stream ? !stream.allowed && stream.reason === "CONTACTS_ONLY" : false;
  const isFollowersOnly = stream ? !stream.allowed && stream.reason === "FOLLOWERS_ONLY" : false;
  const isInvitedOnly = stream ? !stream.allowed && stream.reason === "INVITED_ONLY" : false;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {paymentState === "success" && !stream?.allowed && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Payment received — the video unlocks as soon as the payment provider confirms it.
        </div>
      )}
      {paymentState === "cancelled" && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-xs text-zinc-400">
          Payment cancelled. Nothing was charged.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {isLoading || !details ? (
            <div className="aspect-video w-full rounded-2xl bg-zinc-900 animate-pulse flex items-center justify-center border border-white/5">
              <span className="text-xs text-zinc-500 font-mono">Verifying access…</span>
            </div>
          ) : (
            <VideoPlayer
              videoId={videoId}
              streamUrl={stream?.streamUrl}
              posterUrl={details.thumbnailUrl ?? undefined}
              title={title}
              isPaywalled={isPaywalled}
              minTipAmountCents={minTipAmountCents}
              isContactsOnly={isContactsOnly}
              isFollowersOnly={isFollowersOnly}
              isInvitedOnly={isInvitedOnly}
              gateAction={
                <RelationshipActions
                  username={details.creatorUsername}
                  show={isFollowersOnly ? ["follow"] : ["contact"]}
                  onChange={() => void fetchStreamAccess()}
                />
              }
              onUnlockRequested={() => setIsTipModalOpen(true)}
            />
          )}

          {details && (
            <div className="mt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsTipModalOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/20 hover:from-violet-500 hover:to-fuchsia-500 transition-all hover:scale-105 active:scale-95"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{isPaywalled ? "Unlock" : "Send Tip"}</span>
                  </button>
                  {stream?.allowed &&
                    (user ? (
                      <button
                        onClick={toggleLike}
                        disabled={likeBusy}
                        aria-pressed={liked}
                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                          liked ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                        }`}
                      >
                        <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
                        <span>{details.likesCount.toLocaleString("en-US")}</span>
                      </button>
                    ) : (
                      <Link href="/auth/login" className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800">
                        <Heart className="h-4 w-4" />
                        <span>{details.likesCount.toLocaleString("en-US")}</span>
                      </Link>
                    ))}
                  <SaveToPlaylist videoId={videoId} />
                  <button
                    onClick={share}
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <Share2 className="h-4 w-4" />
                    <span>{copied ? "Link copied" : "Share"}</span>
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
                  {details.viewsCount.toLocaleString("en-US")} views
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5 text-zinc-500" />
                  {details.commentsCount.toLocaleString("en-US")}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Share2 className="h-3.5 w-3.5 text-zinc-500" />
                  {details.sharesCount.toLocaleString("en-US")}
                </span>
                <span>•</span>
                <span>{formatDuration(details.durationSeconds)}</span>
                <span>•</span>
                <span>
                  {new Date(details.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>

              <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/5 bg-zinc-900/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-violet-500/30">
                    <img src={details.creatorAvatar || AVATAR_PLACEHOLDER} alt={details.creatorName} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{details.creatorName}</span>
                      <ShieldCheck className="h-4 w-4 text-violet-400" aria-label="2257 verified creator" />
                    </div>
                    <span className="text-xs text-zinc-400">@{details.creatorUsername}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <RelationshipActions username={details.creatorUsername} show={["follow"]} size="sm" onChange={() => void fetchStreamAccess()} />
                  <Link
                    href={`/creators/${details.creatorUsername}`}
                    className="rounded-xl border border-white/10 bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-semibold text-white transition-all"
                  >
                    View profile
                  </Link>
                </div>
              </div>

              {(details.description || details.creatorBio) && (
                <p className="mt-4 text-sm text-zinc-300 leading-relaxed bg-zinc-900/30 rounded-2xl p-4 border border-white/5 whitespace-pre-line">
                  {details.description || details.creatorBio}
                </p>
              )}

              {stream?.allowed && (
                <VideoComments
                  videoId={videoId}
                  isCreator={user?.username === details.creatorUsername}
                  commentsEnabled={details.commentsEnabled}
                  onCountChange={(delta) => setDetails((d) => (d ? { ...d, commentsCount: Math.max(0, d.commentsCount + delta) } : d))}
                />
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
            <h3 className="text-sm font-bold text-white mb-3">How this stream is protected</h3>
            <ul className="space-y-2.5 text-xs text-zinc-400">
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                <span>Playback links are signed and expire after five minutes — they cannot be shared or hotlinked.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-fuchsia-400 mt-1.5 shrink-0" />
                <span>Access is checked on the server for every play: contacts, unlocks and creator ownership.</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>Unlocks are granted only after the payment provider confirms the payment.</span>
              </li>
            </ul>
          </div>

          {details && details.moreFromCreator.length > 0 && (
            <div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-5">
              <h3 className="text-sm font-bold text-white mb-3">More from {details.creatorName}</h3>
              <div className="space-y-3">
                {details.moreFromCreator.map((video) => (
                  <Link key={video.id} href={`/watch/${video.id}`} className="flex gap-3 items-center group">
                    <div className="h-16 w-24 rounded-lg bg-zinc-800 overflow-hidden shrink-0">
                      {video.thumbnailUrl && (
                        <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white group-hover:text-violet-400 line-clamp-1">{video.title}</h4>
                      <span className="block text-[10px] text-zinc-500 font-mono">
                        {formatDuration(video.durationSeconds)} • {video.visibility === "PUBLIC" ? "Free" : "Members"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {details && (
        <>
          <TipModal
            isOpen={isTipModalOpen}
            onClose={() => setIsTipModalOpen(false)}
            videoId={videoId}
            creatorName={details.creatorName}
            minTipAmountCents={Math.max(minTipAmountCents, 100)}
            onUnlockedSuccess={() => void fetchStreamAccess()}
          />
          <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            videoId={videoId}
            videoTitle={title}
          />
        </>
      )}
    </div>
  );
}
