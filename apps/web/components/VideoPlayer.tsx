"use client";

import Hls from "hls.js";
import { Gavel, Lock, Maximize, Pause, Play, RotateCcw, Sparkles, Users, Volume2, VolumeX } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

import { Badge, Button, cn, IconButton, OrochiaLogo, Slider, Spinner } from "@/components/ui";
import { isAdultRating } from "@/lib/content-ratings";
import { useI18n } from "@/lib/i18n-client";
import { orientationOf } from "@/lib/video-aspect";

import { DOCUMENT_FULLSCREEN_EVENTS, enterFullscreen, exitFullscreen, type FullscreenDocument, type FullscreenTarget, type FullscreenVideo, isFullscreen, VIDEO_FULLSCREEN_EVENTS } from "./player-fullscreen";
import { useWatchReport } from "./watch-report";

/** The player's box, one for the loading state, the error and the player itself: nothing moves when the video arrives. */
function frameClass(width?: number | null, height?: number | null, fullscreen = false) {
  const shape = orientationOf(width, height);
  return cn(
    "theme-dark relative w-full overflow-hidden rounded-2xl bg-black border border-border-subtle shadow-2xl",
    fullscreen
      ? "h-dvh w-dvw max-h-none max-w-none rounded-none border-0"
      : shape === "vertical"
        ? "mx-auto aspect-[9/16] max-h-[calc(100dvh-13rem-env(safe-area-inset-bottom))] max-w-[min(100%,28rem)] md:max-h-[calc(100dvh-5rem)]"
        : shape === "square"
          ? "mx-auto aspect-square max-h-[calc(100dvh-13rem-env(safe-area-inset-bottom))] md:max-h-[calc(100dvh-5rem)]"
          : "aspect-video",
  );
}

/** Failures that are the player's own: this many fatal errors in a row and it offers a retry instead of looping. */
const MAX_FATAL_ERRORS = 3;

/**
 * Before the player stands (the details are on their way): the poster and a quiet Krizaka spinner. No text — the
 * wait is a picture, never a sentence — and the same box as the player, so nothing jumps.
 */
export function PlayerLoading({ posterUrl, width, height }: { posterUrl?: string | null; width?: number | null; height?: number | null }) {
  return (
    <div className={frameClass(width, height)} aria-busy="true" data-testid="player-loading">
      {posterUrl && (
         
        <img src={posterUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-scrim/30">
        <Spinner size="lg" />
      </div>
    </div>
  );
}

/** The video could not be opened (not a refusal: a failure). Clear words and one action. */
export function PlayerError({ onRetry, width, height }: { onRetry: () => void; width?: number | null; height?: number | null }) {
  const { t } = useI18n();
  return (
    <div className={cn(frameClass(width, height), "flex flex-col items-center justify-center gap-3 p-6 text-center")} role="alert" data-testid="player-error">
      <h3 className="text-base font-bold text-fg sm:text-lg">{t("player.errorTitle")}</h3>
      <p className="max-w-md text-sm text-fg-secondary">{t("player.errorBody")}</p>
      <Button variant="primary" shape="rounded" onClick={onRetry} className="gap-2 rounded-xl px-5">
        <RotateCcw className="h-4 w-4" aria-hidden />
        <span>{t("player.retry")}</span>
      </Button>
    </div>
  );
}

interface VideoPlayerProps {
  videoId: string;
  streamUrl?: string | null;
  posterUrl?: string | null;
  /** The source picture's size: a vertical clip plays vertical — full height on a phone — a horizontal one full width. */
  width?: number | null;
  height?: number | null;
  title?: string;
  isPaywalled?: boolean;
  minTipAmountCents?: number;
  isContactsOnly?: boolean;
  isFollowersOnly?: boolean;
  isInvitedOnly?: boolean;
  /** Up for auction (or sold at one): only the winning bidder plays it. */
  isAuction?: boolean;
  /** Delivered for a challenge's backers. */
  isChallenge?: boolean;
  /** Rendered in the contacts / followers / auction gate: the action that opens the video (follow, contact). */
  gateAction?: React.ReactNode;
  onUnlockRequested?: () => void;
  contentRatingId?: string | null;
  isBlurred?: boolean;
  isAdult?: boolean;
  /** Encoded with the Stream library's burned-in watermark (lib/watermark.ts): no second mark over it. */
  burnedWatermark?: boolean;
}

export function VideoPlayer({
  videoId,
  streamUrl,
  posterUrl,
  width,
  height,
  title,
  isPaywalled = false,
  minTipAmountCents = 0,
  isContactsOnly = false,
  isFollowersOnly = false,
  isInvitedOnly = false,
  isAuction = false,
  isChallenge = false,
  gateAction,
  onUnlockRequested,
  contentRatingId,
  isBlurred = false,
  isAdult = false,
  burnedWatermark = false,
}: VideoPlayerProps) {
  const { t, money } = useI18n();
  const isGated = isContactsOnly || isFollowersOnly || isInvitedOnly || isAuction || isChallenge;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [revealed, setRevealed] = useState(!isBlurred);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1); // -1 = auto
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  // The first frame is on screen (poster until then, behind a spinner); `buffering` is a stall after that.
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useWatchReport(videoId, videoRef);

  // Initialize HLS Stream
  useEffect(() => {
    if (!videoRef.current || !streamUrl || isPaywalled || isGated) return;

    const video = videoRef.current;
    let hls: Hls | null = null;
    let fatalErrors = 0;
    setReady(false);
    setFailed(false);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        const levels = data.levels.map((l) => `${l.height}p`);
        setQualityLevels(["Auto", ...levels]);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          if (++fatalErrors >= MAX_FATAL_ERRORS) {
            hls?.destroy();
            setFailed(true);
            return;
          }
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("Fatal network error encountered, recovering...", data);
              hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("Fatal media error encountered, recovering...", data);
              hls?.recoverMediaError();
              break;
            default:
              console.error("Unrecoverable HLS error:", data);
              hls?.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native Safari HLS support
      video.src = streamUrl;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [streamUrl, isPaywalled, isGated, attempt]);

  // The media element is the truth: play/pause state follows its events (native controls, fullscreen, a refused play()).
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => setIsPlaying(false));
    else video.pause();
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  // The first frame: stamped on the element (`data-first-frame-ms`, since navigation start) so a test reads the wait.
  const handleFirstFrame = () => {
    setReady(true);
    setBuffering(false);
    const video = videoRef.current;
    if (video && !video.dataset.firstFrameMs) {
      video.dataset.firstFrameMs = String(Math.round(performance.now()));
      performance.mark("orochia:first-frame");
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    videoRef.current.muted = nextMuted;
  };

  // Follow the fullscreen state through both APIs (container: document events; iPhone's native video: its own events).
  useEffect(() => {
    const video = videoRef.current as (HTMLVideoElement & FullscreenVideo) | null;
    if (!video) return;
    const sync = () => setFullscreen(isFullscreen(video, document as FullscreenDocument));
    DOCUMENT_FULLSCREEN_EVENTS.forEach((e) => document.addEventListener(e, sync));
    VIDEO_FULLSCREEN_EVENTS.forEach((e) => video.addEventListener(e, sync));
    return () => {
      DOCUMENT_FULLSCREEN_EVENTS.forEach((e) => document.removeEventListener(e, sync));
      VIDEO_FULLSCREEN_EVENTS.forEach((e) => video.removeEventListener(e, sync));
    };
  }, []);

  const toggleFullscreen = async () => {
    const video = videoRef.current as (HTMLVideoElement & FullscreenVideo) | null;
    const container = containerRef.current as (HTMLDivElement & FullscreenTarget) | null;
    if (!video || !container) return;
    const doc = document as FullscreenDocument;
    try {
      if (isFullscreen(video, doc)) await exitFullscreen(video, doc);
      else await enterFullscreen(video, container, doc);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      ref={containerRef}
      className={cn(frameClass(width, height, fullscreen), "@container group select-none")}
      // A mouse hides the controls while playing; a finger never does (iOS swallows the first tap after a hover change).
      onPointerEnter={(e) => e.pointerType === "mouse" && setShowControls(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && isPlaying && setShowControls(false)}
    >
      {/* 18+ Rating Badge Top Left */}
      {(isAdult || isAdultRating(contentRatingId)) && (
        <div className="absolute top-4 left-4 z-20">
          <Badge size="sm" className="bg-danger/90 font-mono font-black text-white shadow-md ring-0 backdrop-blur-md">
            18+
          </Badge>
        </div>
      )}

      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        data-testid="player-video"
        poster={posterUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={handleFirstFrame}
        onPlaying={() => {
          setBuffering(false);
          handleFirstFrame();
        }}
        onWaiting={() => setBuffering(true)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        className={cn(
          "h-full w-full object-contain cursor-pointer transition-all duration-500",
          isBlurred && !revealed ? "blur-2xl scale-105" : ""
        )}
        onClick={isBlurred && !revealed ? undefined : togglePlay}
        playsInline
      />

      {/* Loading: the poster stays under a quiet spinner (no words) until the first frame, and again on a stall. */}
      {!isPaywalled && !isGated && !failed && streamUrl && (!ready || buffering) && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-scrim/30" data-testid="player-spinner">
          <Spinner size="lg" />
        </div>
      )}

      {/* The stream could not be opened after a few tries: say so, offer a retry. */}
      {!isPaywalled && !isGated && failed && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-scrim-strong p-6 text-center" role="alert" data-testid="player-error">
          <h3 className="text-base font-bold text-fg-on-media sm:text-lg">{t("player.errorTitle")}</h3>
          <p className="max-w-md text-sm text-fg-on-media/80">{t("player.errorBody")}</p>
          <Button variant="primary" shape="rounded" onClick={() => setAttempt((n) => n + 1)} className="gap-2 rounded-xl px-5">
            <RotateCcw className="h-4 w-4" aria-hidden />
            <span>{t("player.retry")}</span>
          </Button>
        </div>
      )}

      {/* The Orochia mark: a quiet signature in the bottom-right corner, scaled with the player, lifted above the controls
          while they show (never over them) and gone in full screen, where nothing should compete with the picture.
          Copies leaving the site carry the burned-in watermark of the Stream library instead (scripts/bunny-library.mjs). */}
      {!isPaywalled && !isGated && !fullscreen && !burnedWatermark && (
        <span
          aria-hidden
          data-testid="player-watermark"
          className={cn(
            "pointer-events-none absolute right-[3cqw] z-10 h-[clamp(1.25rem,6cqw,2.5rem)] w-[clamp(1.25rem,6cqw,2.5rem)] opacity-40 transition-[bottom] duration-300",
            showControls ? "bottom-[clamp(5rem,16cqw,6rem)]" : "bottom-[3cqw]",
          )}
        >
          <OrochiaLogo size={40} animated={false} className="h-full w-full" />
        </span>
      )}

      {/* Sensitive Content Gate Overlay */}
      {isBlurred && !revealed && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-scrim-strong backdrop-blur-lg p-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-danger/20 border border-danger/30 flex items-center justify-center text-fg-danger mb-3">
            <span className="font-mono font-black text-xl">18+</span>
          </div>
          <h3 className="text-lg font-bold text-fg-on-media mb-1">{t("player.sensitiveTitle")}</h3>
          <p className="text-xs text-fg-secondary max-w-sm mb-5">
            {t("player.sensitiveBody")}
          </p>
          <Button variant="primary" shape="rounded" onClick={() => setRevealed(true)} className="rounded-xl px-5 text-xs shadow-lg shadow-accent/25">
            {t("player.reveal")}
          </Button>
        </div>
      )}

      {/* Paywall Overlay State */}
      {isPaywalled && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-scrim-strong backdrop-blur-md p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-accent/30 to-accent-2/30 border border-accent/30 mb-4 shadow-lg shadow-accent/20">
            <Lock className="h-8 w-8 text-fg-accent" />
          </div>
          <h3 className="text-xl font-bold text-fg-on-media mb-1">{t("player.paidTitle")}</h3>
          <p className="text-sm text-fg-secondary max-w-md mb-6">
            {t("player.paidBody")}
          </p>
          <Button variant="sensual" size="lg" shape="rounded" onClick={onUnlockRequested} className="gap-2.5 rounded-xl px-6">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span>{t("player.paidCta", { price: money(minTipAmountCents) })}</span>
          </Button>
        </div>
      )}

      {/* Contacts-only / followers-only gate */}
      {!isPaywalled && isGated && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-scrim-strong backdrop-blur-md p-6 text-center">
          <div className="flex h-11 w-11 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-scrim-strong border border-fg-on-media/20 mb-2 sm:mb-4">
            {isAuction ? <Gavel className="h-5 w-5 sm:h-8 sm:w-8 text-fg-accent" /> : <Users className="h-5 w-5 sm:h-8 sm:w-8 text-fg-on-media/80" />}
          </div>
          <h3 className="text-base sm:text-xl font-bold text-fg-on-media mb-1">
            {t(isAuction ? "player.auctionTitle" : isChallenge ? "player.challengeTitle" : isInvitedOnly ? "player.invitedTitle" : isFollowersOnly ? "player.followersTitle" : "player.contactsTitle")}
          </h3>
          <p className="hidden sm:block text-sm text-fg-secondary max-w-md mb-6">
            {t(isAuction ? "player.auctionBody" : isChallenge ? "player.challengeBody" : isInvitedOnly ? "player.invitedBody" : isFollowersOnly ? "player.followersBody" : "player.contactsBody")}
          </p>
          {!isInvitedOnly && gateAction}
        </div>
      )}

      {/* Custom Video Controls. On a phone the player ends above the fixed tab bar (MobileBottomNav, 4rem + safe area): sized by the 13rem above, so the bar never covers the controls. */}
      {!isPaywalled && !isGated && (
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 z-20 bg-linear-to-t from-scrim-strong via-scrim to-transparent p-4 text-fg-on-media transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Progress Timeline Slider */}
          <div className="mb-3">
            <Slider
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onValueChange={handleSeek}
              label={t("player.seek")}
              formatValue={formatTime}
              className="cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-sm text-fg-on-media">
            <div className="flex items-center gap-4">
              {/* Play / Pause Button */}
              <IconButton onClick={togglePlay} className="h-8 w-8 text-current hover:bg-accent-soft hover:text-fg-accent" label={isPlaying ? t("player.pause") : t("player.play")}>
                {isPlaying ? <Pause className="h-5 w-5" aria-hidden /> : <Play className="h-5 w-5" aria-hidden />}
              </IconButton>

              {/* Volume Controls */}
              <div className="flex items-center gap-2 group/vol">
                <IconButton onClick={toggleMute} className="h-8 w-8 text-current hover:bg-accent-soft hover:text-fg-accent" label={isMuted || volume === 0 ? t("player.unmute") : t("player.mute")}>
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </IconButton>
                <Slider
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onValueChange={handleVolumeChange}
                  label={t("player.volume")}
                  formatValue={(v) => t("player.volumeValue", { percent: Math.round(v * 100) })}
                  className="w-16 opacity-80 group-hover/vol:opacity-100"
                />
              </div>

              {/* Time Display */}
              <div className="text-xs text-fg-on-media/80 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Fullscreen Button */}
              <IconButton onClick={toggleFullscreen} className="relative z-30 h-11 w-11 touch-manipulation text-current sm:h-8 sm:w-8 hover:bg-accent-soft hover:text-fg-accent" label={t("player.fullscreen")}>
                <Maximize className="h-5 w-5" aria-hidden />
              </IconButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
