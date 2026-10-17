"use client";

import React, { useEffect, useRef, useState } from "react";

import { type BannerVideoView } from "@/lib/banner-types";
import { bannerPlayback } from "@/lib/banner-playback";
import { cn } from "@/components/ui";

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * A moving cover: the still is always painted first (it is the poster); the moment of the video plays on top of it only
 * while the banner is on screen on a profile page and nothing says otherwise (reduced motion, Save-Data, a slow link, a
 * hidden tab — `bannerPlayback`). Muted, looped between the two bounds, `playsinline`. In lists and cards the cover is
 * never this component: it is the still.
 */
export function BannerVideo({ poster, video, className }: { poster: string; video: BannerVideoView; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [env, setEnv] = useState({ reducedMotion: true, saveData: false, effectiveType: undefined as string | undefined, tabVisible: true });

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => {
      const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
      setEnv({ reducedMotion: motion.matches, saveData: Boolean(connection?.saveData), effectiveType: connection?.effectiveType, tabVisible: document.visibilityState === "visible" });
    };
    read();
    motion.addEventListener("change", read);
    document.addEventListener("visibilitychange", read);
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: 0.25 });
    if (box.current) observer.observe(box.current);
    return () => {
      motion.removeEventListener("change", read);
      document.removeEventListener("visibilitychange", read);
      observer.disconnect();
    };
  }, []);

  const mode = bannerPlayback({ ...env, visible, surface: "profile" });

  useEffect(() => {
    const el = player.current;
    if (!el) return;
    if (mode === "play") void el.play().catch(() => undefined);
    else el.pause();
  }, [mode]);

  return (
    <div ref={box} className={cn("absolute inset-0", className)} data-banner-video data-playing={mode === "play"}>
      {mode === "play" && (
        <video
          ref={player}
          src={video.src}
          poster={poster}
          muted
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden
          tabIndex={-1}
          className="h-full w-full object-cover"
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.currentTime >= video.endSeconds || el.currentTime < video.startSeconds - 0.5) el.currentTime = video.startSeconds;
          }}
        />
      )}
    </div>
  );
}
