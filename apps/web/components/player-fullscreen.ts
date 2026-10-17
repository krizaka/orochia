/**
 * Fullscreen for the player, on every browser.
 *
 * iPhone Safari has no `Element.requestFullscreen()` on a container: only the video itself can go fullscreen
 * (`HTMLVideoElement.webkitEnterFullscreen()`, with the system controls). Desktop, Android and iPadOS fullscreen the
 * container, so our own controls stay. One helper chooses; the player never calls either API directly.
 */

export interface FullscreenTarget {
  requestFullscreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => void;
}

export interface FullscreenVideo {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
  webkitDisplayingFullscreen?: boolean;
}

export interface FullscreenDocument {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => void;
}

export type FullscreenMode = "container" | "video" | "none";

/** The events that say the fullscreen state changed: on the document (container) and on the video (iPhone). */
export const DOCUMENT_FULLSCREEN_EVENTS = ["fullscreenchange", "webkitfullscreenchange"] as const;
export const VIDEO_FULLSCREEN_EVENTS = ["webkitbeginfullscreen", "webkitendfullscreen"] as const;

export function isFullscreen(video: FullscreenVideo, doc: FullscreenDocument): boolean {
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || video.webkitDisplayingFullscreen);
}

export async function enterFullscreen(video: FullscreenVideo, container: FullscreenTarget, doc: FullscreenDocument): Promise<FullscreenMode> {
  void doc;
  try {
    if (container.requestFullscreen) {
      await container.requestFullscreen();
      return "container";
    }
    if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
      return "container";
    }
  } catch {
    // refused (some iOS versions expose the method but reject it): the video's own fullscreen below
  }
  if (video.webkitEnterFullscreen) {
    video.webkitEnterFullscreen();
    return "video";
  }
  return "none";
}

export async function exitFullscreen(video: FullscreenVideo, doc: FullscreenDocument): Promise<void> {
  if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
    video.webkitExitFullscreen();
    return;
  }
  if (doc.fullscreenElement && doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }
  if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) doc.webkitExitFullscreen();
}
