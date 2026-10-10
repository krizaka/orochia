"use client";

import {
  BackIcon,
  CloseIcon,
  ForwardIcon,
  GlobeIcon,
  HeartIcon,
  LinkIcon,
  LockIcon,
  MessageIcon,
  MoreIcon,
  PauseIcon,
  PlayIcon,
  TipIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from "@krizaka/icons";
import { Flag, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useCallback, useEffect, useRef, useState } from "react";

import { ReportModal } from "@/components/ReportModal";
import { TipModal } from "@/components/TipModal";
import { AlertDialog, Avatar, Badge, cn, Dialog, DropdownMenu, IconButton, toast } from "@/components/ui";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import {
  autoAdvances,
  classifyGesture,
  HOLD_MS,
  nextCreator,
  nextPosition,
  previousCreator,
  previousPosition,
  rememberSound,
  shortcut,
  soundOn,
  storyAge,
  type StoryPosition,
} from "@/lib/story-player";

import { StoryInsights } from "./StoryInsights";
import { StoryMedia, StoryPreload } from "./StoryMedia";
import type { StoryAudienceId, StoryItem, StoryRing } from "./types";

const AUDIENCE_ICON: Partial<Record<StoryAudienceId, React.ElementType>> = {
  PUBLIC: GlobeIcon,
  APPROVED_FOLLOWERS_ONLY: UsersIcon,
  CONTACTS_ONLY: UserIcon,
  INVITED_ONLY: LockIcon,
  CHALLENGE: LockIcon,
};

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}

/** Who a story is for, as a small badge on the media (@krizaka/ui's scrim Badge; a list's name only for its author). */
function AudienceBadge({ story }: { story: StoryItem }) {
  const Icon = AUDIENCE_ICON[story.audience] ?? LockIcon;
  const label = story.audience === "INVITED_ONLY" && story.audienceListName ? story.audienceListName : t(`stories.viewer.audience.${story.audience in AUDIENCE_ICON ? story.audience : "INVITED_ONLY"}` as "stories.viewer.audience.PUBLIC");
  return (
    <Badge tone="scrim" className="max-w-[11rem] overflow-hidden normal-case tracking-normal">
      <Icon size={11} aria-hidden className="shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </Badge>
  );
}

const overlayButton = "h-9 w-9 bg-scrim text-fg-on-media hover:bg-scrim-strong hover:text-fg-on-media focus-visible:ring-2 focus-visible:ring-fg-on-media/80";

/**
 * The story viewer (full screen on a phone, a 9:16 card on a computer), opened on the story the address names
 * (`?story=<id>`, components/stories/useStories.ts). Plays with sound when the person allows it (muted is a visible
 * choice, kept for the session — M), pauses on a long press, Space or while a panel is open, moves with taps (left
 * part back), arrows and swipes (down closes, sideways changes creator), preloads the next story, and never moves on
 * by itself under reduced motion. Viewers like, answer privately, tip and report; the author sees what the story did
 * (StoryInsights), changes who sees it and removes it (confirmed).
 */
export function StoryViewer({
  rings,
  position,
  onNavigate,
  onClose,
  onStoryChange,
  onRemoved,
}: {
  rings: StoryRing[];
  position: StoryPosition | null;
  onNavigate: (storyId: string) => void;
  onClose: () => void;
  onStoryChange: (storyId: string, change: Partial<StoryItem>) => void;
  onRemoved: () => void;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const ring = position ? rings[position.ring] : null;
  const story = position && ring ? ring.stories[position.story] : null;
  const sizes = rings.map((r) => r.stories.length);
  const reducedMotion = useReducedMotion();

  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [sound, setSound] = useState(true);
  const [autoplayMuted, setAutoplayMuted] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [panel, setPanel] = useState<null | "tip" | "report" | "insights" | "remove" | "menu">(null);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [likePulse, setLikePulse] = useState(0);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setSound(soundOn(sessionStore())), []);

  const veiled = Boolean(story && story.isBlurred && !ring?.isOwn && !revealed.has(story.id));
  const paused = held || userPaused || panel !== null || replying || veiled || ended;

  const goTo = useCallback((at: StoryPosition | null) => {
    if (!at) return onClose();
    const target = rings[at.ring]?.stories[at.story];
    if (target) onNavigate(target.id);
  }, [rings, onNavigate, onClose]);

  const next = useCallback(() => position && goTo(nextPosition(sizes, position)), [position, goTo, sizes]);
  const previous = useCallback(() => position && goTo(previousPosition(sizes, position)), [position, goTo, sizes]);

  // A new story: progress from zero, playing, counted once as seen.
  const storyId = story?.id;
  useEffect(() => {
    setProgress(0);
    setEnded(false);
    setBuffering(false);
    setUserPaused(false);
    setFailed(false);
    if (!story || ring?.isOwn || story.seen || story.state !== "ready") return;
    void fetch(`/api/stories/${story.id}/view`, { method: "POST" }).then(
      (res) => res.ok && onStoryChange(story.id, { seen: true }),
      () => undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  const onEnded = useCallback(() => {
    if (autoAdvances(reducedMotion)) next();
    else setEnded(true);
  }, [reducedMotion, next]);

  const toggleSound = useCallback(() => {
    setAutoplayMuted(false);
    setSound((on) => {
      const value = autoplayMuted ? true : !on;
      rememberSound(sessionStore(), value);
      return value;
    });
  }, [autoplayMuted]);

  const togglePause = useCallback(() => {
    if (ended) {
      setEnded(false);
      next();
      return;
    }
    setUserPaused((p) => !p);
  }, [ended, next]);

  // Keys: ←/→ move, Space pauses, M mutes (Escape is the dialog's). Not while typing a reply or a panel is open.
  useEffect(() => {
    if (!story) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = Boolean(target?.closest("input, textarea, select, [contenteditable=true]")) || panel !== null;
      const action = shortcut(e.key, typing);
      if (!action) return;
      e.preventDefault();
      if (action === "next") next();
      else if (action === "previous") previous();
      else if (action === "togglePause") togglePause();
      else if (action === "toggleSound") toggleSound();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [story, panel, next, previous, togglePause, toggleSound]);

  // Gestures on the story itself: tap (left part back), long press pauses, drag down closes, sideways changes creator.
  const press = useRef<{ x: number; y: number; at: number; timer: number; held: boolean } | null>(null);
  const [dragY, setDragY] = useState(0);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const timer = window.setTimeout(() => {
      if (press.current) press.current.held = true;
      setHeld(true);
    }, HOLD_MS);
    press.current = { x: e.clientX, y: e.clientY, at: performance.now(), timer, held: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!press.current) return;
    const dy = e.clientY - press.current.y;
    if (dy > 0 && Math.abs(dy) > Math.abs(e.clientX - press.current.x)) setDragY(reducedMotion ? 0 : Math.min(dy, 240));
  };
  const endPress = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const p = press.current;
    press.current = null;
    setDragY(0);
    if (!p) return;
    window.clearTimeout(p.timer);
    setHeld(false);
    if (cancelled || p.held || !position) return;
    const box = e.currentTarget.getBoundingClientRect();
    const gesture = classifyGesture({ x: p.x - box.left, width: box.width, dx: e.clientX - p.x, dy: e.clientY - p.y, ms: performance.now() - p.at });
    if (gesture === "previous") previous();
    else if (gesture === "next") {
      setEnded(false);
      next();
    }
    else if (gesture === "close") onClose();
    else if (gesture === "nextCreator") goTo(nextCreator(sizes, position));
    else if (gesture === "previousCreator") goTo(previousCreator(sizes, position));
  };

  const toggleLike = async () => {
    if (!story || !user) return;
    const liked = !story.liked;
    onStoryChange(story.id, { liked, likesCount: Math.max(0, story.likesCount + (liked ? 1 : -1)) });
    if (liked) setLikePulse((n) => n + 1);
    const res = await fetch(`/api/stories/${story.id}/like`, { method: liked ? "POST" : "DELETE" }).catch(() => null);
    if (!res?.ok) {
      onStoryChange(story.id, { liked: story.liked, likesCount: story.likesCount });
      toast.error(t("stories.viewer.likeFailed"));
      return;
    }
    const data = (await res.json()) as { liked: boolean; likesCount: number };
    onStoryChange(story.id, data);
  };

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!story || !ring || !reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/stories/${story.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: reply.trim() }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) {
      const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
      toast.error(res?.status === 403 && data.error ? data.error : t("stories.viewer.replyFailed"));
      return;
    }
    setReply("");
    setReplying(false);
    (document.activeElement as HTMLElement | null)?.blur();
    toast.success(t("stories.viewer.replySent", { name: ring.displayName }), {
      action: { label: t("stories.viewer.openConversation"), onClick: () => router.push(`/messages?user=${encodeURIComponent(ring.username)}`) },
    });
  };

  const copyLink = async () => {
    if (!story) return;
    const url = new URL(window.location.href);
    url.search = new URLSearchParams({ story: story.id }).toString();
    const copied = await navigator.clipboard?.writeText(url.toString()).then(() => true, () => false);
    if (copied) toast.success(t("stories.viewer.linkCopied"));
    else toast.error(t("stories.viewer.linkFailed"));
  };

  const remove = async () => {
    if (!story) return;
    const res = await fetch(`/api/stories/${story.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      toast.error(t("stories.viewer.removeFailed"));
      throw new Error("remove failed");
    }
    toast.success(t("stories.viewer.removed"));
    onRemoved();
  };

  const nextStory = position ? (() => {
    const at = nextPosition(sizes, position);
    return at ? rings[at.ring].stories[at.story] : null;
  })() : null;

  const open = Boolean(ring && story);
  const age = story ? storyAge(story.createdAt) : null;
  const isVideo = story?.type === "video" && story.state === "ready" && !failed;
  const muted = !sound || autoplayMuted;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      {ring && story && position && (
        <Dialog.Content
          size="md"
          hideClose
          aria-describedby={undefined}
          // Focus lands on the viewer itself (keys work at once), never on a tap zone or a button that would show its ring.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true });
          }}
          tabIndex={-1}
          className="theme-dark h-dvh max-h-dvh w-full justify-between overflow-hidden rounded-none border-0 bg-media p-0 outline-none sm:h-[min(88vh,820px)] sm:max-h-[820px] sm:w-auto sm:max-w-none sm:aspect-[9/16] sm:rounded-3xl sm:border sm:border-border-strong"
          style={dragY ? { transform: `translateY(${dragY}px)`, opacity: 1 - dragY / 600 } : undefined}
        >
          <Dialog.Title className="sr-only">{t("stories.viewer.title", { name: ring.displayName })}</Dialog.Title>
          {/* The one thing announced: which story is on screen. */}
          <p className="sr-only" aria-live="polite">
            {t("stories.viewer.position", { current: position.story + 1, total: ring.stories.length, name: ring.displayName })}
          </p>

          {/* The media and the gesture surface (pointer only — keys and the arrow buttons do the same for everyone else). */}
          <div
            className="absolute inset-0 flex touch-none select-none items-center justify-center bg-media"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endPress(e)}
            onPointerCancel={(e) => endPress(e, true)}
            onContextMenu={(e) => e.preventDefault()}
            aria-hidden
          >
            <StoryMedia
              story={story}
              paused={paused}
              sound={!muted}
              veiled={veiled}
              onReveal={() => setRevealed((s) => new Set(s).add(story.id))}
              onProgress={setProgress}
              onEnded={onEnded}
              onAutoplayMuted={() => setAutoplayMuted(true)}
              onBuffering={setBuffering}
              onFailed={setFailed}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-linear-to-b from-scrim-strong to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-linear-to-t from-scrim-strong via-scrim to-transparent" />
            {buffering && !paused && (
              <span className="pointer-events-none absolute flex h-12 w-12 items-center justify-center rounded-full bg-scrim">
                <span className="h-6 w-6 animate-spin rounded-full border-2 border-fg-on-media/30 border-t-fg-on-media motion-reduce:animate-none" />
              </span>
            )}
            {(userPaused || ended) && !veiled && (
              <span className="pointer-events-none absolute flex h-14 w-14 items-center justify-center rounded-full bg-scrim text-fg-on-media">
                <PlayIcon size={26} />
              </span>
            )}
          </div>
          <StoryPreload story={nextStory} />

          {/* Top: progress, author, audience, controls. */}
          <div className="pointer-events-none relative z-20 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
            <div className="mb-3 flex gap-1" aria-hidden>
              {ring.stories.map((s, i) => (
                <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-fg-on-media/30">
                  <div className="h-full rounded-full bg-fg-on-media" style={{ width: i < position.story ? "100%" : i === position.story ? `${progress}%` : "0%" }} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/@${ring.username}`}
                className="pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-xl pr-2 outline-none focus-visible:ring-2 focus-visible:ring-fg-on-media/80"
              >
                <Avatar src={ring.avatarUrl || AVATAR_PLACEHOLDER} alt="" fallback={ring.displayName.charAt(0)} className="h-9 w-9 shrink-0 rounded-xl border border-fg-on-media/30" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold text-fg-on-media drop-shadow-sm">{ring.isOwn ? t("stories.yours") : ring.displayName}</span>
                    {age && <span className="shrink-0 text-xs text-fg-on-media/70">{t(`stories.viewer.age.${age.unit}`, { value: age.value })}</span>}
                  </span>
                  <AudienceBadge story={story} />
                </span>
              </Link>
              <div className="pointer-events-auto flex shrink-0 items-center gap-1">
                {isVideo && (
                  <IconButton onClick={toggleSound} className={overlayButton} label={muted ? t("stories.viewer.soundOn") : t("stories.viewer.soundOff")} aria-pressed={!muted}>
                    {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
                  </IconButton>
                )}
                {story.state === "ready" && (
                  <IconButton onClick={togglePause} className={overlayButton} label={userPaused || ended ? t("stories.viewer.play") : t("stories.viewer.pause")}>
                    {userPaused || ended ? <PlayIcon size={16} /> : <PauseIcon size={16} />}
                  </IconButton>
                )}
                <DropdownMenu.Root open={panel === "menu"} onOpenChange={(o) => setPanel(o ? "menu" : null)}>
                  <DropdownMenu.Trigger asChild>
                    <IconButton className={overlayButton} label={t("stories.viewer.more")}>
                      <MoreIcon size={16} />
                    </IconButton>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Item onSelect={() => void copyLink()}>
                      <LinkIcon size={15} />
                      {t("stories.viewer.copyLink")}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild>
                      <Link href={`/@${ring.username}`}>
                        <UserIcon size={15} />
                        {t("stories.seeProfile")}
                      </Link>
                    </DropdownMenu.Item>
                    {!ring.isOwn && (
                      <DropdownMenu.Item tone="danger" onSelect={() => setTimeout(() => setPanel("report"), 0)}>
                        <Flag className="h-[15px] w-[15px]" aria-hidden />
                        {t("stories.viewer.report")}
                      </DropdownMenu.Item>
                    )}
                    {ring.isOwn && (
                      <DropdownMenu.Item tone="danger" onSelect={() => setTimeout(() => setPanel("remove"), 0)}>
                        <TrashIcon size={15} />
                        {t("stories.remove")}
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
                <Dialog.Close asChild>
                  <IconButton className={overlayButton} label={t("common.close")}>
                    <CloseIcon size={16} />
                  </IconButton>
                </Dialog.Close>
              </div>
            </div>
            {autoplayMuted && isVideo && (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={toggleSound}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-scrim-strong px-3.5 py-1.5 text-xs font-semibold text-fg-on-media outline-none transition-colors hover:bg-scrim focus-visible:ring-2 focus-visible:ring-fg-on-media/80"
                >
                  <VolumeX className="h-3.5 w-3.5" aria-hidden />
                  {t("stories.viewer.tapForSound")}
                </button>
              </div>
            )}
          </div>

          {/* Previous / next: always there for keyboards and screen readers, shown on a computer. */}
          <div className="pointer-events-none relative z-20 flex items-center justify-between px-2">
            <IconButton
              onClick={previous}
              disabled={position.ring === 0 && position.story === 0}
              className={cn(overlayButton, "pointer-events-auto sr-only focus-visible:not-sr-only sm:not-sr-only disabled:opacity-0")}
              label={t("stories.previous")}
            >
              <BackIcon size={18} />
            </IconButton>
            <IconButton onClick={next} className={cn(overlayButton, "pointer-events-auto sr-only focus-visible:not-sr-only sm:not-sr-only")} label={t("stories.next")}>
              <ForwardIcon size={18} />
            </IconButton>
          </div>

          {/* Bottom: caption and actions. */}
          <div className="pointer-events-none relative z-20 space-y-3 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
            {story.caption && !veiled && <p className="line-clamp-4 text-sm leading-relaxed text-fg-on-media drop-shadow-sm">{story.caption}</p>}
            {ring.isOwn ? (
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPanel("insights")}
                  className="flex h-11 flex-1 items-center gap-3 rounded-2xl bg-scrim px-4 text-left text-fg-on-media outline-none transition-colors hover:bg-scrim-strong focus-visible:ring-2 focus-visible:ring-fg-on-media/80"
                >
                  <span className="text-xs font-semibold">{t("stories.viewer.activity")}</span>
                  <span className="ml-auto flex items-center gap-3 font-mono text-xs text-fg-on-media/85">
                    <span>{t("stories.views", { count: story.viewsCount })}</span>
                    <span className="flex items-center gap-1">
                      <HeartIcon size={13} aria-hidden />
                      {story.likesCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <TipIcon size={13} aria-hidden />
                      {story.tipsCount}
                    </span>
                  </span>
                </button>
                <IconButton onClick={() => setPanel("remove")} className={cn(overlayButton, "h-11 w-11 hover:bg-danger/70")} label={t("stories.remove")}>
                  <TrashIcon size={18} />
                </IconButton>
              </div>
            ) : user ? (
              <form onSubmit={sendReply} className="pointer-events-auto flex items-center gap-2">
                <label className="sr-only" htmlFor="story-reply">
                  {t("stories.viewer.replyLabel", { name: ring.displayName })}
                </label>
                <span className="relative flex h-11 min-w-0 flex-1 items-center">
                  <MessageIcon size={16} className="pointer-events-none absolute left-3.5 text-fg-on-media/70" />
                  <input
                    id="story-reply"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onFocus={() => setReplying(true)}
                    onBlur={() => !reply.trim() && setReplying(false)}
                    maxLength={1000}
                    enterKeyHint="send"
                    autoComplete="off"
                    placeholder={t("stories.viewer.replyPlaceholder", { name: ring.displayName })}
                    className="h-full w-full rounded-full border border-fg-on-media/35 bg-scrim pl-10 pr-4 text-sm text-fg-on-media outline-none transition-colors placeholder:text-fg-on-media/65 focus:border-fg-on-media/80"
                  />
                </span>
                {replying && reply.trim() ? (
                  <button
                    type="submit"
                    disabled={sending}
                    className="h-11 shrink-0 rounded-full bg-fg-on-media px-4 text-xs font-bold text-media outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                  >
                    {sending ? t("stories.viewer.sending") : t("stories.viewer.send")}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => void toggleLike()}
                      aria-pressed={story.liked}
                      aria-label={story.liked ? t("stories.viewer.unlike") : t("stories.viewer.like")}
                      className={cn(
                        "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-fg-on-media/80",
                        story.liked ? "bg-danger/25 text-danger" : "bg-scrim text-fg-on-media hover:bg-scrim-strong",
                      )}
                    >
                      <HeartIcon key={likePulse} size={20} className={cn(story.liked && "orochia-like-pop fill-current")} />
                      {story.likesCount > 0 && <span className="font-mono text-xs">{story.likesCount}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPanel("tip")}
                      aria-label={t("stories.viewer.tip", { name: ring.displayName })}
                      className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-linear-to-r from-accent to-accent-2 px-3.5 text-xs font-bold text-on-accent shadow-lg shadow-accent/30 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-fg-on-media/80"
                    >
                      <TipIcon size={18} />
                      <span className="hidden min-[380px]:inline">{t("stories.viewer.tipShort")}</span>
                    </button>
                  </>
                )}
              </form>
            ) : (
              <Link
                href={`/auth/login?next=${encodeURIComponent(`${pathname}?story=${story.id}`)}`}
                className="pointer-events-auto flex h-11 items-center justify-center rounded-full bg-scrim text-xs font-semibold text-fg-on-media outline-none transition-colors hover:bg-scrim-strong focus-visible:ring-2 focus-visible:ring-fg-on-media/80"
              >
                {t("stories.viewer.signInToReact")}
              </Link>
            )}
          </div>

          {!ring.isOwn && (
            <>
              <TipModal
                isOpen={panel === "tip"}
                onClose={() => setPanel(null)}
                storyId={story.id}
                creatorName={ring.displayName}
                minTipAmountCents={ring.minTipCents}
                onUnlockedSuccess={() => {
                  toast.success(t("stories.viewer.tipSent", { name: ring.displayName }));
                  setPanel(null);
                }}
              />
              <ReportModal
                isOpen={panel === "report"}
                onClose={() => setPanel(null)}
                videoId=""
                storyId={story.id}
                videoTitle={t("stories.viewer.reportTitle", { username: ring.username })}
              />
            </>
          )}
          {ring.isOwn && (
            <>
              <StoryInsights
                open={panel === "insights"}
                onClose={() => setPanel(null)}
                story={story}
                onAudienceChanged={(audience, audienceListName) => onStoryChange(story.id, { audience, audienceListName })}
              />
              <AlertDialog
                open={panel === "remove"}
                onOpenChange={(o) => setPanel(o ? "remove" : null)}
                title={t("stories.viewer.removeTitle")}
                description={t("stories.removeConfirm")}
                confirmLabel={t("stories.viewer.removeConfirm")}
                tone="danger"
                onConfirm={remove}
              />
            </>
          )}
        </Dialog.Content>
      )}
    </Dialog.Root>
  );
}
