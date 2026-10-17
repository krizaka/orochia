/**
 * Full screen that works on every browser. iPhone Safari has no `requestFullscreen` on a container (only on the
 * `<video>` itself, through `webkitEnterFullscreen`); iPad and desktop have the standard API (older Safari: `webkit`
 * prefix). Calling `container.requestFullscreen()` blindly throws a TypeError on iPhone, so the button "does nothing".
 */
export type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitExitFullscreen?: () => void; webkitDisplayingFullscreen?: boolean };
export type FullscreenContainer = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
export type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };

export function isFullscreen(video: FullscreenVideo | null, doc: FullscreenDocument = document): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement ?? video?.webkitDisplayingFullscreen);
}

/** Enter or leave full screen; resolves to the route taken (for tests and logs), never throws. */
export async function toggleFullscreen(
  container: FullscreenContainer | null,
  video: FullscreenVideo | null,
  doc: FullscreenDocument = document,
): Promise<"standard" | "webkit-container" | "video" | "exit" | "unsupported"> {
  try {
    if (isFullscreen(video, doc)) {
      if (doc.fullscreenElement && doc.exitFullscreen) await doc.exitFullscreen();
      else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
      else video?.webkitExitFullscreen?.();
      return "exit";
    }
    if (container?.requestFullscreen) {
      await container.requestFullscreen();
      return "standard";
    }
    if (container?.webkitRequestFullscreen) {
      await container.webkitRequestFullscreen();
      return "webkit-container";
    }
    if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
      return "video";
    }
  } catch (err) {
    console.warn("Full screen refused", err);
  }
  return "unsupported";
}
