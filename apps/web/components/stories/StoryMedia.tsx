"use client";

import { EyeIcon, WarningIcon } from "@krizaka/icons";
import Hls from "hls.js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button, Spinner } from "@/components/ui";
import { t } from "@/lib/i18n";
import { blockedByAutoplayPolicy, IMAGE_STORY_MS, imageProgress, type PlaybackError, playbackError, videoProgress } from "@/lib/story-player";

import type { StoryItem } from "./types";

export interface PlaybackFailure {
  kind: PlaybackError;
  status: number | null;
}

interface MediaProps {
  story: StoryItem;
  paused: boolean;
  /** The person's choice (session); the media may still be muted by the browser's autoplay policy. */
  sound: boolean;
  onProgress: (percent: number) => void;
  onEnded: () => void;
  /** The browser refused sound without a gesture: playing muted until the person taps "sound". */
  onAutoplayMuted: () => void;
  onBuffering: (waiting: boolean) => void;
  /** The story cannot play (the viewer hides its sound controls and does not move on). */
  onFailed?: (failed: boolean) => void;
}

/**
 * A video story: the signed HLS playlist (lib/stories.ts, 15 minutes, this viewer only) played by hls.js in a plain
 * <video> — Safari plays HLS natively. Not Bunny's iframe player: the viewer's own controls (progress, sound, pause,
 * gestures) drive the element directly, and the zero-trust signing stays ours. Progress follows the media clock
 * (requestAnimationFrame), sound follows the person's choice, and a fatal error is shown with what it means (a CDN
 * refusal says "403"), never hidden behind a black frame.
 */
function StoryVideo({ story, paused, sound, onProgress, onEnded, onAutoplayMuted, onBuffering, onFailed }: MediaProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failure, setFailure] = useState<PlaybackFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The latest choices, read when a new story starts loading (the load effect itself only follows the story).
  const soundRef = useRef(sound);
  const pausedRef = useRef(paused);
  useLayoutEffect(() => {
    soundRef.current = sound;
    pausedRef.current = paused;
  });

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    setFailure(null);
    let hls: Hls | null = null;
    const fail = (f: PlaybackFailure) => {
      setFailure(f);
      onBuffering(false);
    };
    if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 20, startLevel: -1, capLevelToPlayerSize: true });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        const status = data.response?.code ?? null;
        fail({ kind: playbackError({ type: data.type, responseCode: status }), status: status || null });
        hls?.destroy();
      });
      hls.loadSource(story.url);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = story.url;
    } else {
      fail({ kind: "media", status: null });
      return;
    }

    // Sound when the person wants it; the browser may refuse it without a gesture it trusts — then muted, and said.
    video.muted = !soundRef.current;
    const start = () => {
      if (pausedRef.current) return;
      video.play().catch((error: unknown) => {
        if (!blockedByAutoplayPolicy(error) || video.muted) return;
        video.muted = true;
        onAutoplayMuted();
        void video.play().catch(() => undefined);
      });
    };
    start();
    return () => {
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
    // Only a new story (or a retry) reloads the media; the callbacks are read through refs or are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.url, attempt]);

  // Sound follows the choice (a tap on "sound" is the gesture browsers ask for).
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.muted = !sound;
    if (sound && !paused && video.paused && !failure) void video.play().catch(() => undefined);
  }, [sound, paused, failure]);

  // Pause and play; the progress follows the media clock while it plays.
  useEffect(() => {
    const video = ref.current;
    if (!video || failure) return;
    if (paused) {
      video.pause();
      return;
    }
    void video.play().catch((error: unknown) => {
      if (blockedByAutoplayPolicy(error) && !video.muted) {
        video.muted = true;
        onAutoplayMuted();
        void video.play().catch(() => undefined);
      }
    });
    let frame = 0;
    const tick = () => {
      onProgress(videoProgress(video.currentTime, video.duration));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, failure, onProgress, onAutoplayMuted]);

  useEffect(() => onFailed?.(failure !== null), [failure, onFailed]);

  if (failure) return <PlaybackFailed failure={failure} onRetry={() => setAttempt((n) => n + 1)} />;

  return (
    <video
      ref={ref}
      poster={story.thumbnailUrl ?? undefined}
      playsInline
      preload="auto"
      onEnded={onEnded}
      onWaiting={() => onBuffering(true)}
      onPlaying={() => onBuffering(false)}
      onCanPlay={() => onBuffering(false)}
      onError={(e) => {
        // Native HLS (Safari) reports no HTTP status: the media error code says whether the network failed.
        const code = e.currentTarget.error?.code ?? null;
        if (!Hls.isSupported()) setFailure({ kind: playbackError({ mediaErrorCode: code }), status: null });
      }}
      className="h-full w-full object-cover sm:object-contain"
    />
  );
}

/** A story that cannot play: what happened, in words, with the HTTP status when the CDN gave one, and a retry. */
function PlaybackFailed({ failure, onRetry }: { failure: PlaybackFailure; onRetry: () => void }) {
  return (
    <div role="alert" className="flex max-w-xs flex-col items-center gap-3 px-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-scrim text-warning">
        <WarningIcon size={22} />
      </span>
      <p className="text-sm font-semibold text-fg-on-media">{t(`stories.viewer.errors.${failure.kind}.title`)}</p>
      <p className="text-xs leading-relaxed text-fg-on-media/75">{t(`stories.viewer.errors.${failure.kind}.hint`)}</p>
      {failure.status !== null && <p className="font-mono text-[11px] text-fg-on-media/60">{t("stories.viewer.errors.status", { status: failure.status })}</p>}
      <Button size="sm" variant="secondary" onClick={onRetry} className="pointer-events-auto">
        {t("stories.viewer.errors.retry")}
      </Button>
    </div>
  );
}

/** An image story: shown IMAGE_STORY_MS, its progress paused with the viewer. */
function StoryImage({ story, paused, onProgress, onEnded }: Pick<MediaProps, "story" | "paused" | "onProgress" | "onEnded">) {
  const elapsed = useRef(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    elapsed.current = 0;
    setFailed(false);
  }, [story.id]);
  useEffect(() => {
    if (paused || failed) return;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      elapsed.current += now - last;
      last = now;
      const p = imageProgress(elapsed.current, IMAGE_STORY_MS);
      onProgress(p);
      if (p >= 100) onEnded();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paused, failed, onProgress, onEnded, story.id]);
  if (failed) return <PlaybackFailed failure={{ kind: "missing", status: null }} onRetry={() => setFailed(false)} />;
  return <img src={story.url} alt={story.caption || ""} onError={() => setFailed(true)} className="h-full w-full object-cover sm:object-contain" />;
}

/**
 * What a story shows: the media, or — for a story its author asked to blur — a veiled preview the viewer reveals with
 * a tap (nothing plays, nothing counts as progress, before that). The author always sees their own story.
 */
export function StoryMedia(props: MediaProps & { veiled: boolean; onReveal: () => void }) {
  const { story, veiled, onReveal } = props;
  if (story.state !== "ready") {
    return (
      <div className="flex max-w-xs flex-col items-center gap-2 px-6 text-center">
        {story.state === "processing" && <Spinner size="md" label={t("stories.processing")} className="text-fg-on-media" />}
        <p className="text-sm font-semibold text-fg-on-media">{t(story.state === "processing" ? "stories.processing" : "stories.failed")}</p>
        <p className="text-xs text-fg-on-media/75">{t(story.state === "processing" ? "stories.processingHint" : "stories.failedHint")}</p>
      </div>
    );
  }
  if (veiled) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        {story.thumbnailUrl && <img src={story.thumbnailUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl" />}
        <div className="absolute inset-0 bg-scrim" />
        <div className="relative flex max-w-xs flex-col items-center gap-3 px-6 text-center">
          <p className="text-sm font-semibold text-fg-on-media">{t("stories.viewer.sensitive")}</p>
          <p className="text-xs text-fg-on-media/75">{t("stories.viewer.sensitiveHint")}</p>
          <Button size="sm" variant="secondary" onClick={onReveal} className="pointer-events-auto gap-1.5">
            <EyeIcon size={16} />
            {t("stories.viewer.reveal")}
          </Button>
        </div>
      </div>
    );
  }
  return story.type === "video" ? <StoryVideo key={story.id} {...props} /> : <StoryImage key={story.id} {...props} />;
}

/**
 * Warms up the next story while this one plays, so moving on is instant: an image is fetched; a video's poster is
 * fetched and its first seconds are buffered by a muted, detached hls.js instance (the browser's cache serves them to
 * the visible player). Destroyed as soon as the viewer moves.
 */
export function StoryPreload({ story }: { story: StoryItem | null }) {
  useEffect(() => {
    if (!story || story.state !== "ready" || story.isBlurred) return;
    const poster = story.thumbnailUrl ?? (story.type === "image" ? story.url : null);
    if (poster) new Image().src = poster;
    if (story.type !== "video" || !Hls.isSupported()) return;
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    const hls = new Hls({ maxBufferLength: 4, maxMaxBufferLength: 4, startLevel: -1 });
    hls.on(Hls.Events.ERROR, () => hls.destroy());
    hls.loadSource(story.url);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [story]);
  return null;
}
