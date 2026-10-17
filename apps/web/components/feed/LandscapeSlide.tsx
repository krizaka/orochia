"use client";

import { Heart, Maximize2, MessageCircle, Share2, Sparkles, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";

import { cn, IconButton } from "@/components/ui";
import type { VideoCardProps } from "@/components/VideoCard";
import { useI18n } from "@/lib/i18n-client";

const BUTTON = "h-11 min-h-11 w-11 min-w-11 bg-scrim text-fg-on-media backdrop-blur-md hover:bg-scrim";

/**
 * A 16:9 (or square) video in the vertical feed: a clean, centred player over a blurred copy of its own poster, the
 * creator, the title and the actions underneath — never a strip squeezed between rails. A tap unmutes (the first one),
 * then plays or pauses. The video plays only while its slide is in view.
 */
export function LandscapeSlide({
  video,
  src,
  active,
  sound,
  onSound,
  liked,
  onLike,
  onComment,
  onShare,
  onTip,
}: {
  video: VideoCardProps;
  src?: string;
  active: boolean;
  sound: boolean;
  onSound: (on: boolean) => void;
  liked: boolean;
  onLike: (liked: boolean) => void;
  onComment: () => void;
  onShare: () => void;
  onTip: () => void;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = !sound;
  }, [sound, src]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    if (active && !paused) void el.play().catch(() => undefined);
    else el.pause();
    if (!active) el.currentTime = 0;
  }, [active, paused, src]);

  const tap = () => {
    if (!sound) onSound(true);
    else setPaused((p) => !p);
  };

  return (
    <div className="theme-dark relative flex h-full w-full flex-col items-center justify-center gap-4 overflow-hidden px-3 pt-12 text-fg-on-media">
      {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl" />}
      <div className="absolute inset-0 bg-scrim" aria-hidden />
      <div className="relative w-full overflow-hidden rounded-2xl bg-media shadow-2xl ring-1 ring-border-subtle aspect-video" data-testid="landscape-player">
        <video
          ref={ref}
          src={src}
          poster={video.thumbnailUrl ?? undefined}
          className="h-full w-full object-contain"
          playsInline
          loop
          muted
          preload={active ? "auto" : "metadata"}
          aria-label={video.title}
        />
        <button
          type="button"
          onClick={tap}
          aria-label={!sound ? t("feed.vertical.tapForSound") : paused ? t("feed.vertical.play") : t("feed.vertical.pause")}
          className="absolute inset-0 flex items-end justify-start p-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {!sound && (
            <span className="inline-flex items-center gap-1 rounded-full bg-scrim px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
              <VolumeX className="h-4 w-4" aria-hidden /> {t("feed.vertical.tapForSound")}
            </span>
          )}
        </button>
      </div>
      <div className="relative flex w-full flex-col gap-3">
        <div>
          <h3 className="line-clamp-2 text-base font-semibold">{video.title}</h3>
          <p className="mt-0.5 text-sm opacity-80">{video.creatorName}</p>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label={t("feed.vertical.like")} aria-pressed={liked} variant="ghost" shape="pill" onClick={() => onLike(!liked)} className={cn(BUTTON, liked && "text-fg-danger")}>
            <Heart className={cn("h-5 w-5", liked && "fill-current")} aria-hidden />
          </IconButton>
          <IconButton label={t("feed.vertical.comment")} variant="ghost" shape="pill" onClick={onComment} className={BUTTON}>
            <MessageCircle className="h-5 w-5" aria-hidden />
          </IconButton>
          <IconButton label={t("feed.vertical.share")} variant="ghost" shape="pill" onClick={onShare} className={BUTTON}>
            <Share2 className="h-5 w-5" aria-hidden />
          </IconButton>
          <IconButton label={t("feed.vertical.tip")} variant="ghost" shape="pill" onClick={onTip} className={BUTTON}>
            <Sparkles className="h-5 w-5" aria-hidden />
          </IconButton>
          <span className="flex-1" />
          <IconButton label={sound ? t("feed.vertical.mute") : t("feed.vertical.sound")} aria-pressed={sound} variant="ghost" shape="pill" onClick={() => onSound(!sound)} className={BUTTON}>
            {sound ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
          </IconButton>
          <Link href={`/watch/${video.id}`} className={cn(BUTTON, "inline-flex items-center justify-center rounded-full")} aria-label={t("feed.vertical.fullscreen")}>
            <Maximize2 className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
