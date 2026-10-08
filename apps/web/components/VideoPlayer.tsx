"use client";

import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Lock,
  Users,
  Sparkles,
} from "lucide-react";
import { t } from "@/lib/i18n";

interface VideoPlayerProps {
  videoId: string;
  streamUrl?: string | null;
  posterUrl?: string | null;
  title?: string;
  isPaywalled?: boolean;
  minTipAmountCents?: number;
  isContactsOnly?: boolean;
  isFollowersOnly?: boolean;
  isInvitedOnly?: boolean;
  /** Rendered in the contacts / followers gate: the action that opens the video (follow, contact). */
  gateAction?: React.ReactNode;
  onUnlockRequested?: () => void;
  contentRatingId?: string | null;
  isBlurred?: boolean;
  isAdult?: boolean;
}

export function VideoPlayer({
  videoId,
  streamUrl,
  posterUrl,
  title,
  isPaywalled = false,
  minTipAmountCents = 0,
  isContactsOnly = false,
  isFollowersOnly = false,
  isInvitedOnly = false,
  gateAction,
  onUnlockRequested,
  contentRatingId,
  isBlurred = false,
  isAdult = false,
}: VideoPlayerProps) {
  const isGated = isContactsOnly || isFollowersOnly || isInvitedOnly;
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

  // Initialize HLS Stream
  useEffect(() => {
    if (!videoRef.current || !streamUrl || isPaywalled || isGated) return;

    const video = videoRef.current;
    let hls: Hls | null = null;

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
  }, [streamUrl, isPaywalled, isGated]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
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

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
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
      className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black border border-white/10 shadow-2xl group select-none"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* 18+ Rating Badge Top Left */}
      {(isAdult || contentRatingId === "MATURE_18" || contentRatingId === "ADULT_EXPLICIT") && (
        <div className="absolute top-4 left-4 z-20">
          <span className="rounded-full bg-rose-600/90 px-2 py-0.5 text-[10px] font-black text-white shadow-md backdrop-blur-md font-mono">
            18+
          </span>
        </div>
      )}

      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        poster={posterUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className={`h-full w-full object-contain cursor-pointer transition-all duration-500 ${
          isBlurred && !revealed ? "blur-2xl scale-105" : ""
        }`}
        onClick={isBlurred && !revealed ? undefined : togglePlay}
        playsInline
      />

      {/* Sensitive Content Gate Overlay */}
      {isBlurred && !revealed && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-lg p-6 text-center">
          <div className="h-14 w-14 rounded-2xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3">
            <span className="font-mono font-black text-xl">18+</span>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">{t("player.sensitiveTitle")}</h3>
          <p className="text-xs text-zinc-400 max-w-sm mb-5">
            {t("player.sensitiveBody")}
          </p>
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-violet-600/25"
          >
            {t("player.reveal")}
          </button>
        </div>
      )}

      {/* Paywall Overlay State */}
      {isPaywalled && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-violet-600/30 to-fuchsia-600/30 border border-violet-500/30 mb-4 shadow-lg shadow-violet-500/20">
            <Lock className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">{t("player.paidTitle")}</h3>
          <p className="text-sm text-zinc-400 max-w-md mb-6">
            {t("player.paidBody")}
          </p>
          <button
            onClick={onUnlockRequested}
            className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-linear-to-r from-violet-600 via-fuchsia-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white font-semibold text-sm shadow-lg shadow-fuchsia-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <Sparkles className="h-4 w-4" />
            <span>{t("player.paidCta", { price: `$${(minTipAmountCents / 100).toFixed(2)}` })}</span>
          </button>
        </div>
      )}

      {/* Contacts-only / followers-only gate */}
      {!isPaywalled && isGated && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80 border border-zinc-700/50 mb-4">
            <Users className="h-8 w-8 text-zinc-300" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">
            {t(isInvitedOnly ? "player.invitedTitle" : isFollowersOnly ? "player.followersTitle" : "player.contactsTitle")}
          </h3>
          <p className="text-sm text-zinc-400 max-w-md mb-6">
            {t(isInvitedOnly ? "player.invitedBody" : isFollowersOnly ? "player.followersBody" : "player.contactsBody")}
          </p>
          {!isInvitedOnly && gateAction}
        </div>
      )}

      {/* Custom Video Controls */}
      {!isPaywalled && !isGated && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 bg-linear-to-t from-black/90 via-black/40 to-transparent p-4 transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Progress Timeline Slider */}
          <div className="mb-3">
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              aria-label={t("player.seek")}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-500 hover:h-1.5 transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-white text-sm">
            <div className="flex items-center gap-4">
              {/* Play / Pause Button */}
              <button
                onClick={togglePlay}
                className="hover:text-violet-400 transition-colors p-1"
                aria-label={isPlaying ? t("player.pause") : t("player.play")}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </button>

              {/* Volume Controls */}
              <div className="flex items-center gap-2 group/vol">
                <button
                  onClick={toggleMute}
                  aria-label={isMuted || volume === 0 ? t("player.unmute") : t("player.mute")}
                  className="hover:text-violet-400 transition-colors p-1"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label={t("player.volume")}
                  className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-500 opacity-80 group-hover/vol:opacity-100"
                />
              </div>

              {/* Time Display */}
              <div className="text-xs text-zinc-300 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Fullscreen Button */}
              <button
                onClick={toggleFullscreen}
                className="hover:text-violet-400 transition-colors p-1"
                aria-label={t("player.fullscreen")}
              >
                <Maximize className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
