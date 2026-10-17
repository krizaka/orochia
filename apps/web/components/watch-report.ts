"use client";

import { type RefObject, useEffect } from "react";

/** The seconds actually played, from the media element's `played` ranges (a seek back is not counted twice). */
export function playedSeconds(played: Pick<TimeRanges, "length" | "start" | "end">): number {
  let total = 0;
  for (let i = 0; i < played.length; i++) total += Math.max(0, played.end(i) - played.start(i));
  return Math.round(total * 10) / 10;
}

/**
 * Tells Orochia, once per play, how much of the video was watched when the viewer left it — on the end, on leaving the
 * page or the tab, or when the player goes away (ADR-081). `sendBeacon` survives the page closing; the server decides
 * what to record (nothing for a guest or the creator).
 */
export function useWatchReport(videoId: string, videoRef: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    let sent = false;
    const report = () => {
      const video = videoRef.current;
      if (sent || !video || typeof navigator.sendBeacon !== "function") return;
      const watchedSeconds = playedSeconds(video.played);
      if (watchedSeconds <= 0) return;
      sent = true;
      const durationSeconds = Number.isFinite(video.duration) ? video.duration : 0;
      navigator.sendBeacon(`/api/videos/${videoId}/watch`, new Blob([JSON.stringify({ watchedSeconds, durationSeconds })], { type: "application/json" }));
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") report();
    };
    const video = videoRef.current;
    video?.addEventListener("ended", report);
    window.addEventListener("pagehide", report);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      report();
      video?.removeEventListener("ended", report);
      window.removeEventListener("pagehide", report);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [videoId, videoRef]);
}
