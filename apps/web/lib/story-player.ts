/**
 * The story viewer's rules, pure and tested (lib/story-player.test.ts): where "next" and "previous" lead, what a
 * gesture means, how long an image stays, whether the viewer moves on by itself, the sound preference and what a
 * playback error says. The components (components/stories/) only wire these to the DOM.
 */

/** Where the viewer stands: a creator's ring and one of its stories. */
export interface StoryPosition {
  ring: number;
  story: number;
}

/** An image story stays this long (a video lasts its own length). */
export const IMAGE_STORY_MS = 6000;
/** A press held this long pauses the story (released, it plays on; no navigation). */
export const HOLD_MS = 220;
/** A drag this far down closes the viewer; this far sideways changes creator. */
export const SWIPE_CLOSE_PX = 90;
export const SWIPE_CREATOR_PX = 70;
/** The left part of the story that goes back on a tap (the rest goes on), as on every stories app. */
export const TAP_BACK_RATIO = 0.3;

/** The story after this one: the next of the ring, else the first of the next ring, else null (the viewer closes). */
export function nextPosition(ringSizes: readonly number[], at: StoryPosition): StoryPosition | null {
  if (at.story < (ringSizes[at.ring] ?? 0) - 1) return { ring: at.ring, story: at.story + 1 };
  return nextCreator(ringSizes, at);
}

/** The story before this one: the previous of the ring, else the last of the previous ring, else the same (start). */
export function previousPosition(ringSizes: readonly number[], at: StoryPosition): StoryPosition {
  if (at.story > 0) return { ring: at.ring, story: at.story - 1 };
  if (at.ring > 0) return { ring: at.ring - 1, story: Math.max(0, (ringSizes[at.ring - 1] ?? 1) - 1) };
  return at;
}

/** The first story of the next creator, or null after the last one. */
export function nextCreator(ringSizes: readonly number[], at: StoryPosition): StoryPosition | null {
  for (let ring = at.ring + 1; ring < ringSizes.length; ring++) if (ringSizes[ring] > 0) return { ring, story: 0 };
  return null;
}

/** The first story of the previous creator (or the start of this one). */
export function previousCreator(ringSizes: readonly number[], at: StoryPosition): StoryPosition {
  return at.ring > 0 ? { ring: at.ring - 1, story: 0 } : { ring: at.ring, story: 0 };
}

/** Where a ring opens: its first story not seen yet, else its first. */
export function startOf(stories: readonly { seen: boolean }[]): number {
  return Math.max(0, stories.findIndex((s) => !s.seen));
}

/** The position of a story by id (the address `?story=<id>`), or null when the viewer may not see it (any more). */
export function findStory(rings: readonly { stories: readonly { id: string }[] }[], storyId: string): StoryPosition | null {
  for (let ring = 0; ring < rings.length; ring++) {
    const story = rings[ring].stories.findIndex((s) => s.id === storyId);
    if (story >= 0) return { ring, story };
  }
  return null;
}

export type Gesture = "previous" | "next" | "close" | "nextCreator" | "previousCreator" | "none";

/**
 * What a pointer press meant, from where it started (x in the story's width), how far it moved and how long it
 * lasted: a tap goes back (left part) or on; a drag down closes; a drag sideways changes creator; a press held
 * long (a pause) or a small wobble means nothing.
 */
export function classifyGesture(input: { x: number; width: number; dx: number; dy: number; ms: number }): Gesture {
  const { x, width, dx, dy, ms } = input;
  if (dy > SWIPE_CLOSE_PX && dy > Math.abs(dx)) return "close";
  if (Math.abs(dx) > SWIPE_CREATOR_PX && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "nextCreator" : "previousCreator";
  if (Math.abs(dx) > 12 || Math.abs(dy) > 12 || ms >= HOLD_MS) return "none";
  return x < width * TAP_BACK_RATIO ? "previous" : "next";
}

/**
 * Whether the viewer moves on by itself when a story ends. Under `prefers-reduced-motion` it does not: nothing
 * changes on screen unless the person asks (a tap, an arrow) — the story stays on its last frame.
 */
export function autoAdvances(reducedMotion: boolean): boolean {
  return !reducedMotion;
}

/** An image story's progress (0–100) after `elapsedMs` of being shown (pauses excluded by the caller). */
export function imageProgress(elapsedMs: number, durationMs = IMAGE_STORY_MS): number {
  if (durationMs <= 0) return 100;
  return Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100));
}

/** A video story's progress (0–100) from the media element's clock. */
export function videoProgress(currentTime: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (currentTime / duration) * 100));
}

/** The sound preference lives for the browser session (not forever: a story opened tomorrow in public starts muted). */
export const SOUND_KEY = "orochia.stories.sound";

type Store = Pick<Storage, "getItem" | "setItem">;

/** Whether stories play with sound: on unless muted earlier in this session (opening a story is a tap — sound may play). */
export function soundOn(storage: Store | null | undefined): boolean {
  try {
    return storage?.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function rememberSound(storage: Store | null | undefined, on: boolean): void {
  try {
    storage?.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // Private mode or storage blocked: the choice lasts for this page only.
  }
}

/**
 * Browsers refuse to start a video with sound without a gesture they trust (autoplay policy): the play() promise
 * rejects with NotAllowedError. The viewer then plays muted and says so ("Tap for sound") — never silently.
 */
export function blockedByAutoplayPolicy(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: string }).name === "NotAllowedError";
}

export type PlaybackError = "denied" | "missing" | "network" | "media";

/**
 * What a fatal playback error means, from hls.js's error data (or a media element error). "denied" is the CDN
 * refusing the signed URL (HTTP 401/403 — token authentication, allowed domains); it is shown as such, with the
 * status, because it is a configuration problem, not a network hiccup.
 */
export function playbackError(input: { type?: string; responseCode?: number | null; mediaErrorCode?: number | null }): PlaybackError {
  const code = input.responseCode ?? 0;
  if (code === 401 || code === 403) return "denied";
  if (code === 404 || code === 410) return "missing";
  if (input.type === "networkError" || code >= 500) return "network";
  if (input.mediaErrorCode === 2) return "network";
  return "media";
}

export type ShortcutAction = "previous" | "next" | "togglePause" | "toggleSound" | null;

/** The viewer's keys (Escape is the dialog's): ←/→ move, Space pauses, M mutes. Ignored while typing. */
export function shortcut(key: string, typing: boolean): ShortcutAction {
  if (typing) return null;
  if (key === "ArrowLeft") return "previous";
  if (key === "ArrowRight") return "next";
  if (key === " " || key === "Spacebar" || key === "k" || key === "K") return "togglePause";
  if (key === "m" || key === "M") return "toggleSound";
  return null;
}

/** "5m", "3h": how long ago a story was shared (it lives 24 hours). */
export function storyAge(createdAt: string | Date, now = Date.now()): { unit: "m" | "h"; value: number } {
  const minutes = Math.max(1, Math.round((now - new Date(createdAt).getTime()) / 60000));
  return minutes < 60 ? { unit: "m", value: minutes } : { unit: "h", value: Math.min(24, Math.round(minutes / 60)) };
}
