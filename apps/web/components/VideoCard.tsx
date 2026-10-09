"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, CheckCircle2, Eye, Flame, Gavel, Heart, Lock, Play, Sparkles, Users } from "lucide-react";
import { t } from "@/lib/i18n";
import { TipModal } from "@/components/TipModal";
import type { VideoVisibility } from "@/lib/visibility";
import { Avatar, Badge, Button, cn, IconButton } from "@/components/ui";

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
  const isChallenge = visibility === "CHALLENGE";

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
        className="kz-spotlight group relative flex flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-1/70 transition-all duration-300 hover:border-accent/50 hover:shadow-2xl hover:shadow-accent/20 md:hover:-translate-y-1 w-full max-w-full"
      >
        {/* Thumbnail & Video Preview Container */}
        <Link href={`/watch/${id}`} className="relative block aspect-video w-full overflow-hidden bg-zinc-900">
          {((isHovered && previewAnimationUrl) || thumbnailUrl) && !broken ? (
            <img
              src={isHovered && previewAnimationUrl ? previewAnimationUrl : thumbnailUrl!}
              ref={picture}
              alt=""
              onError={() => setBroken(true)}
              className={cn(
                "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
                isBlurred && !revealed ? "blur-xl scale-110" : ""
              )}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-accent/15 via-zinc-950 to-accent-2/15 text-accent light:via-slate-50">
              <Play className="h-10 w-10 text-accent/60" />
            </div>
          )}

          {/* Sensitive Content Blur Reveal Overlay */}
          {isBlurred && !revealed && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-scrim backdrop-blur-md p-4 text-center z-10">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent mb-1">
                {t("card.sensitive")}
              </span>
              <Button
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setRevealed(true);
                }}
                className="h-7 border-0 bg-white/20 px-3 text-[11px] text-fg-on-media hover:bg-white/30"
              >
                {t("card.reveal")}
              </Button>
            </div>
          )}

          {/* Hover Play Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/90 text-white shadow-xl shadow-accent/40 backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
              <Play className="h-5 w-5 fill-white ml-0.5" />
            </div>
          </div>

          {/* Quality & Duration badges */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 z-10">
            <span className="rounded-sm bg-scrim-strong px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent backdrop-blur-md">
              4K
            </span>
            <span className="rounded-sm bg-scrim-strong px-2 py-0.5 font-mono text-[10px] font-medium text-fg-on-media backdrop-blur-md">
              {formatDuration(durationSeconds)}
            </span>
          </div>

          {/* Badges Container Top-Left */}
          <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 z-10">
            {(isAdult || contentRatingId === "MATURE_18" || contentRatingId === "ADULT_EXPLICIT") && (
              <Badge size="sm" className="bg-danger/90 font-mono font-black text-white shadow-md ring-0 backdrop-blur-md">
                18+
              </Badge>
            )}

            {isPaywalled && (
              <div className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-accent to-accent-2 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
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
              <div className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-accent-2 to-accent-2 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
                <Gavel className="h-3 w-3" />
                <span>{t("card.auction")}</span>
              </div>
            )}

            {isChallenge && (
              <div className="flex items-center gap-1.5 rounded-full bg-linear-to-r from-accent to-accent-2 px-3 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur-md">
                <Flame className="h-3 w-3" />
                <span>{t("card.challenge")}</span>
              </div>
            )}

            {!isPaywalled && !isContacts && !isAuction && !isChallenge && (
              <Badge size="sm" tone="success" className="normal-case tracking-normal backdrop-blur-md">
                {t("card.free")}
              </Badge>
            )}
          </div>

          {/* Floating Quick Action Buttons on Hover */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
            <IconButton
              onClick={handleLike}
              label={isLiked ? t("card.unlike") : t("card.like")}
              aria-pressed={isLiked}
              shape="rounded"
              className={cn(
                "h-8 w-8 rounded-xl backdrop-blur-md active:scale-90",
                isLiked
                  ? "bg-danger text-white shadow-md shadow-danger/40 hover:bg-danger hover:text-white"
                  : "bg-scrim text-fg-on-media hover:bg-black/80 hover:text-fg-on-media"
              )}
            >
              <Heart className={cn("h-4 w-4", isLiked ? "fill-white" : "")} aria-hidden />
            </IconButton>
            <IconButton
              onClick={handleSave}
              label={isSaved ? t("card.saved") : t("card.save")}
              aria-pressed={isSaved}
              shape="rounded"
              className={cn(
                "h-8 w-8 rounded-xl backdrop-blur-md active:scale-90",
                isSaved
                  ? "bg-accent text-white shadow-md shadow-accent/40 hover:bg-accent hover:text-white"
                  : "bg-scrim text-fg-on-media hover:bg-black/80 hover:text-fg-on-media"
              )}
            >
              <Bookmark className={cn("h-4 w-4", isSaved ? "fill-white" : "")} aria-hidden />
            </IconButton>
          </div>
        </Link>

        {/* Card Metadata */}
        <div className="flex flex-1 flex-col justify-between p-4">
          <div className="flex gap-3">
            {/* Creator Avatar with link */}
            <Link
              href={creatorUsername ? `/@${creatorUsername}` : "#"}
              className="relative h-10 w-10 shrink-0 transition-transform hover:scale-105"
            >
              <Avatar src={creatorAvatar || "/avatar-placeholder.svg"} alt={creatorName} fallback={creatorName.charAt(0)} className="h-10 w-10 rounded-xl border border-border-default" />
            </Link>

            {/* Video Title & Creator Name */}
            <div className="min-w-0 flex-1">
              <Link href={`/watch/${id}`}>
                <h3 className="line-clamp-2 text-xs sm:text-sm font-semibold text-fg group-hover:text-accent transition-colors">
                  {title}
                </h3>
              </Link>
              <div className="mt-1 flex items-center gap-1.5">
                <Link
                  href={creatorUsername ? `/@${creatorUsername}` : "#"}
                  className="text-xs text-fg-secondary hover:text-fg transition-colors truncate"
                >
                  {creatorName}
                </Link>
                <CheckCircle2 className="h-3 w-3 text-success shrink-0" />
              </div>
            </div>
          </div>

          {/* Bottom Stats & Quick Tip Button */}
          <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-2.5 text-[11px] text-fg-muted font-mono">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {viewsCount.toLocaleString()}
              </span>
              {tipsCount > 0 && (
                <span className="flex items-center gap-1 text-accent font-semibold">
                  <Sparkles className="h-3 w-3" />
                  {tipsCount}
                </span>
              )}
            </div>

            {/* Direct Quick Tip Button */}
            <Button
              size="sm"
              shape="rounded"
              onClick={handleOpenTip}
              className="h-6 gap-1 border-accent/30 bg-accent/10 px-2 text-[10px] text-accent hover:border-accent hover:bg-accent hover:text-on-accent"
            >
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
              <span>{t("card.tip")}</span>
            </Button>
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
