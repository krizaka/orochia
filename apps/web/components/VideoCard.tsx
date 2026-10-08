"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, CheckCircle2, Eye, Gavel, Heart, Lock, Play, Sparkles, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import { TipModal } from "@/components/TipModal";
import type { VideoVisibility } from "@/lib/visibility";

export interface VideoCardProps {
  id: string;
  title: string;
  creatorName: string;
  creatorUsername?: string;
  creatorAvatar?: string | null;
  thumbnailUrl?: string | null;
  previewAnimationUrl?: string | null;
  durationSeconds: number;
  visibility: VideoVisibility;
  minTipAmountCents: number;
  viewsCount: number;
  tipsCount: number;
  likesCount?: number;
  contentRatingId?: string | null;
  isBlurred?: boolean;
  isAdult?: boolean;
}

export function VideoCard({
  id,
  title,
  creatorName,
  creatorUsername,
  creatorAvatar,
  thumbnailUrl,
  previewAnimationUrl,
  durationSeconds,
  visibility,
  minTipAmountCents,
  viewsCount,
  tipsCount,
  likesCount = 0,
  contentRatingId,
  isBlurred = false,
  isAdult = false,
}: VideoCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isTipModalOpen, setIsTipModalOpen] = useState(false);
  const [localLikes, setLocalLikes] = useState(likesCount);
  const [revealed, setRevealed] = useState(!isBlurred);
  // A video still encoding has no picture yet: show the placeholder rather than a broken image.
  const [broken, setBroken] = useState(false);
  const picture = useRef<HTMLImageElement>(null);
  // The image may fail before hydration, when React is not listening yet.
  useEffect(() => {
    const img = picture.current;
    if (img?.complete && img.naturalWidth === 0) setBroken(true);
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isPaywalled = visibility === "TIPPED_UNLOCKED";
  const isContacts = visibility === "CONTACTS_ONLY";
  const isAuction = visibility === "AUCTION";

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLocalLikes(isLiked ? localLikes - 1 : localLikes + 1);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaved(!isSaved);
  };

  const handleOpenTip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTipModalOpen(true);
  };

  return (
    <>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="kz-spotlight group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-950/70 dark:bg-zinc-950/70 light:bg-white transition-all duration-300 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-950/20 md:hover:-translate-y-1 w-full max-w-full"
      >
        {/* Thumbnail & Video Preview Container */}
        <Link href={`/watch/${id}`} className="relative block aspect-video w-full overflow-hidden bg-zinc-900">
          {((isHovered && previewAnimationUrl) || thumbnailUrl) && !broken ? (
            <img
              src={isHovered && previewAnimationUrl ? previewAnimationUrl : thumbnailUrl!}
              ref={picture}
              alt=""
              onError={() => setBroken(true)}
              className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
                isBlurred && !revealed ? "blur-xl scale-110" : ""
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-violet-950/40 via-zinc-950 to-fuchsia-950/40 text-violet-400 light:from-violet-100 light:via-slate-50 light:to-fuchsia-100">
              <Play className="h-10 w-10 text-violet-400/60" />
            </div>
          )}

          {/* Sensitive Content Blur Reveal Overlay */}
          {isBlurred && !revealed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md p-4 text-center z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300 mb-1">
                {t("card.sensitive")}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRevealed(true);
                }}
                className="px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-[11px] font-semibold text-white transition-colors"
              >
                {t("card.reveal")}
              </button>
            </div>
          )}

          {/* Hover Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/90 text-white shadow-xl shadow-violet-600/40 backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
              <Play className="h-5 w-5 fill-white ml-0.5" />
            </div>
          </div>

          {/* Quality & Duration badges */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 z-10">
            <span className="rounded-sm bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-bold text-violet-300 backdrop-blur-md">
              4K
            </span>
            <span className="rounded-sm bg-black/80 px-2 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur-md">
              {formatDuration(durationSeconds)}
            </span>
          </div>

          {/* Badges Container Top-Left */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 z-10">
            {(isAdult || contentRatingId === "MATURE_18" || contentRatingId === "ADULT_EXPLICIT") && (
              <span className="rounded-full bg-rose-600/90 px-2 py-0.5 text-[10px] font-black text-white shadow-md backdrop-blur-md font-mono">
                18+
              </span>
            )}

            {isPaywalled && (
              <div className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-violet-600 to-fuchsia-600 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
                <Lock className="h-3 w-3" />
                <span>{t("card.unlockFor", { price: `$${(minTipAmountCents / 100).toFixed(2)}` })}</span>
              </div>
            )}

            {isContacts && (
              <div className="flex items-center gap-1.5 rounded-full bg-zinc-900/90 px-3 py-1 text-[11px] font-semibold text-zinc-300 backdrop-blur-md">
                <Users className="h-3 w-3" />
                <span>{t("card.contacts")}</span>
              </div>
            )}

            {isAuction && (
              <div className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-fuchsia-600 to-pink-600 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
                <Gavel className="h-3 w-3" />
                <span>{t("card.auction")}</span>
              </div>
            )}

            {!isPaywalled && !isContacts && !isAuction && (
              <div className="flex items-center gap-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 backdrop-blur-md">
                <span>{t("card.free")}</span>
              </div>
            )}
          </div>

          {/* Floating Quick Action Buttons on Hover */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
            <button
              onClick={handleLike}
              title={isLiked ? t("card.unlike") : t("card.like")}
              aria-label={isLiked ? t("card.unlike") : t("card.like")}
              aria-pressed={isLiked}
              className={`flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-md transition-all active:scale-90 ${
                isLiked
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/40"
                  : "bg-black/60 text-white hover:bg-black/80"
              }`}
            >
              <Heart className={`h-4 w-4 ${isLiked ? "fill-white" : ""}`} />
            </button>
            <button
              onClick={handleSave}
              title={isSaved ? t("card.saved") : t("card.save")}
              aria-label={isSaved ? t("card.saved") : t("card.save")}
              aria-pressed={isSaved}
              className={`flex h-8 w-8 items-center justify-center rounded-xl backdrop-blur-md transition-all active:scale-90 ${
                isSaved
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/40"
                  : "bg-black/60 text-white hover:bg-black/80"
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? "fill-white" : ""}`} />
            </button>
          </div>
        </Link>

        {/* Card Metadata */}
        <div className="flex flex-1 flex-col justify-between p-4">
          <div className="flex gap-3">
            {/* Creator Avatar with link */}
            <Link
              href={creatorUsername ? `/@${creatorUsername}` : "#"}
              className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 dark:border-white/10 light:border-black/5 bg-zinc-800 transition-transform hover:scale-105"
            >
              <img
                src={creatorAvatar || "/avatar-placeholder.svg"}
                alt={creatorName}
                className="h-full w-full object-cover"
              />
            </Link>

            {/* Video Title & Creator Name */}
            <div className="min-w-0 flex-1">
              <Link href={`/watch/${id}`}>
                <h3 className="line-clamp-2 text-xs sm:text-sm font-semibold text-white dark:text-white light:text-slate-900 group-hover:text-violet-400 transition-colors">
                  {title}
                </h3>
              </Link>
              <div className="mt-1 flex items-center gap-1.5">
                <Link
                  href={creatorUsername ? `/@${creatorUsername}` : "#"}
                  className="text-xs text-zinc-400 dark:text-zinc-400 light:text-slate-500 hover:text-white dark:hover:text-white hover:light:text-black transition-colors truncate"
                >
                  {creatorName}
                </Link>
                <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
              </div>
            </div>
          </div>

          {/* Bottom Stats & Quick Tip Button */}
          <div className="mt-3 flex items-center justify-between border-t border-white/5 dark:border-white/5 light:border-black/5 pt-2.5 text-[11px] text-zinc-500 dark:text-zinc-500 light:text-slate-400 font-mono">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {viewsCount.toLocaleString()}
              </span>
              {tipsCount > 0 && (
                <span className="flex items-center gap-1 text-fuchsia-400 font-semibold">
                  <Sparkles className="h-3 w-3" />
                  {tipsCount}
                </span>
              )}
            </div>

            {/* Direct Quick Tip Button */}
            <button
              onClick={handleOpenTip}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 hover:bg-violet-600 hover:text-white px-2 py-0.5 text-[10px] font-semibold text-violet-300 transition-all hover:scale-105 active:scale-95 light:border-violet-500/40 light:bg-violet-50 light:text-violet-700 hover:light:bg-violet-600 hover:light:text-white"
            >
              <Sparkles className="h-2.5 w-2.5" />
              <span>{t("card.tip")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Tip Modal */}
      <TipModal
        isOpen={isTipModalOpen}
        onClose={() => setIsTipModalOpen(false)}
        videoId={id}
        creatorName={creatorName}
        minTipAmountCents={minTipAmountCents}
        onUnlockedSuccess={() => {
          setIsTipModalOpen(false);
        }}
      />
    </>
  );
}
