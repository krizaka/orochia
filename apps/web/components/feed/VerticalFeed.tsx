"use client";

import { ShortFeed, VerticalVideo, type VerticalVideoLabels } from "@krizaka/ui/vertical-video";
import { Sparkles, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import { LandscapeSlide } from "@/components/feed/LandscapeSlide";
import { TipModal } from "@/components/TipModal";
import { cn, IconButton } from "@/components/ui";
import type { VideoCardProps } from "@/components/VideoCard";
import { useAuth } from "@/lib/auth-context";
import { mayStream } from "@/lib/feed-view";
import { createWatchTracker, type WatchReport } from "@/lib/feed-watch";
import { useI18n } from "@/lib/i18n-client";
import { frameOf } from "@/lib/video-aspect";

const matches = (query: string) => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
const saveData = () => typeof navigator !== "undefined" && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

const clock = () => performance.now();
const newId = () => crypto.randomUUID();

/** Sends one look to the recommender: a beacon when the page is being left, a keepalive fetch otherwise. */
function sendWatch(report: WatchReport, leaving: boolean) {
  const body = JSON.stringify(report);
  if (leaving && navigator.sendBeacon) navigator.sendBeacon("/api/feed/events", new Blob([body], { type: "application/json" }));
  else void fetch("/api/feed/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => undefined);
}

const RAIL_BUTTON = "h-11 min-h-11 w-11 min-w-11 bg-scrim text-fg-on-media hover:bg-scrim";

/**
 * The phone's feed: one video per screen, snap-scrolling (@krizaka/ui `ShortFeed` / `VerticalVideo`). The video in view plays
 * muted — a tap or the sound button unmutes the whole feed — and the next one is warmed. A 9:16 clip fills the screen; a 16:9
 * one is a clean centred player over a blurred copy of its own poster (`LandscapeSlide`), with a way to the watch page for full screen. Nothing is requested
 * under Save-Data (posters only); the kit stills the video under reduced motion. The stream comes from the same access
 * decision as the watch page (`/api/videos/:id/stream`), which also records the view for the recommender. For a signed-in
 * viewer, each slide that leaves the screen reports how much was watched and for how long (`/api/feed/events`): a skip or a
 * view, for the recommender (lib/feed-events.ts). The feed fills the screen between the bar and the tab bar.
 */
export function VerticalFeed({ videos, shortsMaxSeconds, onNearEnd, className }: { videos: VideoCardProps[]; /** The Shorts limit (`feed` settings): a longer vertical clip is shown as a Video. */ shortsMaxSeconds?: number; /** The viewer is within three slides of the last one: ask for the next page. */ onNearEnd?: () => void; className?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();
  const signedIn = user !== null;
  const [sound, setSound] = useState(false);
  const [streams, setStreams] = useState<Record<string, string>>({});
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [tipping, setTipping] = useState<VideoCardProps | null>(null);
  // A visitor has no account to learn from: only a signed-in viewer's looks are timed (and reported).
  const [watch] = useState(() => createWatchTracker({ now: clock, uuid: newId, send: sendWatch }));
  const requested = useRef(new Set<string>());
  const allowed = typeof window !== "undefined" && mayStream({ saveData: saveData(), reducedMotion: matches("(prefers-reduced-motion: reduce)") });

  /** Asks for a slide's stream the first time it is in view or next. A refused or failed answer leaves the poster. */
  const warm = (video: VideoCardProps) => {
    if (!allowed || requested.current.has(video.id)) return;
    requested.current.add(video.id);
    void fetch(`/api/videos/${video.id}/stream`, { headers: { Accept: "application/json" } })
      .then((res) => (res.ok ? (res.json() as Promise<{ feedMp4Url?: string }>) : null))
      .then((body) => body?.feedMp4Url && setStreams((s) => ({ ...s, [video.id]: body.feedMp4Url! })))
      .catch(() => undefined);
  };

  useEffect(() => {
    const tracker = watch;
    const hidden = () => document.visibilityState === "hidden" && tracker.leave();
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", tracker.leave);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", tracker.leave);
      tracker.leave();
    };
  }, [watch]);
  const progress = (e: React.SyntheticEvent<HTMLElement>) => {
    const el = e.target as HTMLVideoElement;
    if (el.duration > 0) watch.progress(el.currentTime / el.duration);
  };

  const like = async (video: VideoCardProps, liked: boolean) => {
    setLikes((l) => ({ ...l, [video.id]: liked }));
    const res = await fetch(`/api/videos/${video.id}/like`, { method: liked ? "POST" : "DELETE" }).catch(() => null);
    if (res?.status === 401 || res?.status === 403) {
      setLikes((l) => ({ ...l, [video.id]: !liked }));
      router.push(`/auth/login?next=${encodeURIComponent("/")}`);
    } else if (!res?.ok) setLikes((l) => ({ ...l, [video.id]: !liked }));
  };

  const share = async (video: VideoCardProps) => {
    const url = `${window.location.origin}/watch/${video.id}`;
    if (navigator.share) await navigator.share({ title: video.title, url }).catch(() => undefined);
    else await navigator.clipboard?.writeText(url).catch(() => undefined);
  };

  const labels: Partial<VerticalVideoLabels> = { like: t("feed.vertical.like"), comment: t("feed.vertical.comment"), share: t("feed.vertical.share") };

  return (
    <>
      <ShortFeed
        label={t("feed.vertical.label")}
        items={videos}
        onActiveChange={(index) => index >= videos.length - 3 && onNearEnd?.()}
        getId={(v) => v.id}
        className={cn("h-[calc(100dvh-7.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] rounded-2xl", className)}
        renderItem={(video, { active, preload }) => {
          const landscape = frameOf(video.width, video.height, video.durationSeconds, shortsMaxSeconds) === "landscape";
          const liked = likes[video.id] ?? false;
          return (
            <div
              ref={(el) => {
                if (!el) return;
                if (active || preload === "auto") warm(video);
                if (active && signedIn) watch.begin(video.id);
              }}
              onTimeUpdateCapture={progress}
              // The first tap on a muted feed turns the sound on (and nothing else); after that a tap is the kit's play / pause.
              onClickCapture={(e) => {
                if (sound || landscape || (e.target as HTMLElement).closest("button, a")) return;
                e.stopPropagation();
                setSound(true);
              }}
              className="relative h-full w-full"
              data-frame={landscape ? "landscape" : "portrait"}
            >
              {landscape ? (
                <LandscapeSlide
                  video={video}
                  src={streams[video.id]}
                  active={active}
                  sound={sound}
                  onSound={setSound}
                  liked={liked}
                  onLike={(next) => void like(video, next)}
                  onComment={() => router.push(`/watch/${video.id}#comments`)}
                  onShare={() => void share(video)}
                  onTip={() => setTipping(video)}
                />
              ) : (
                <VerticalVideo
                  fit="fill"
                  title={video.title}
                  src={streams[video.id]}
                  poster={video.thumbnailUrl ?? undefined}
                  active={active}
                  preload={preload}
                  muted={!sound}
                  creator={{ name: video.creatorName, avatarSrc: video.creatorAvatar ?? undefined }}
                  caption={video.title}
                  tags={video.tags?.slice(0, 3)}
                  likes={(video.likesCount ?? 0) + (liked ? 1 : 0)}
                  liked={liked}
                  onLike={(next) => void like(video, next)}
                  onComment={() => router.push(`/watch/${video.id}#comments`)}
                  onShare={() => void share(video)}
                  labels={labels}
                  tipSlot={
                    <IconButton label={t("feed.vertical.tip")} variant="ghost" shape="pill" onClick={() => setTipping(video)} className={RAIL_BUTTON}>
                      <Sparkles className="h-5 w-5" aria-hidden />
                    </IconButton>
                  }
                  topStart={
                    // Under the floating feed tabs.
                    <div className="mt-12 flex items-center gap-2">
                      <IconButton label={sound ? t("feed.vertical.mute") : t("feed.vertical.sound")} aria-pressed={sound} variant="ghost" shape="pill" onClick={() => setSound((s) => !s)} className={RAIL_BUTTON}>
                        {sound ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
                      </IconButton>
                    </div>
                  }
                  className="bg-transparent"
                />
              )}
            </div>
          );
        }}
      />
      {tipping && <TipModal isOpen onClose={() => setTipping(null)} videoId={tipping.id} creatorName={tipping.creatorName} minTipAmountCents={tipping.minTipAmountCents} onUnlockedSuccess={() => setTipping(null)} />}
    </>
  );
}
