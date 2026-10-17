import { describe, expect, it, vi } from "vitest";

import { type FullscreenContainer, type FullscreenDocument, type FullscreenVideo, toggleFullscreen } from "./fullscreen";

const doc = (extra: object = {}) => ({ fullscreenElement: null, ...extra }) as unknown as FullscreenDocument;
const box = (extra: object = {}) => extra as unknown as FullscreenContainer;
const vid = (extra: object = {}) => extra as unknown as FullscreenVideo;

describe("toggleFullscreen", () => {
  it("iPhone (no requestFullscreen on the container) enters through the video's webkitEnterFullscreen", async () => {
    const webkitEnterFullscreen = vi.fn();
    expect(await toggleFullscreen(box(), vid({ webkitEnterFullscreen }), doc())).toBe("video");
    expect(webkitEnterFullscreen).toHaveBeenCalledOnce();
  });

  it("desktop and iPad use the standard API on the container", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const webkitEnterFullscreen = vi.fn();
    expect(await toggleFullscreen(box({ requestFullscreen }), vid({ webkitEnterFullscreen }), doc())).toBe("standard");
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(webkitEnterFullscreen).not.toHaveBeenCalled();
  });

  it("older Safari falls back to the prefixed container API", async () => {
    const webkitRequestFullscreen = vi.fn();
    expect(await toggleFullscreen(box({ webkitRequestFullscreen }), vid(), doc())).toBe("webkit-container");
    expect(webkitRequestFullscreen).toHaveBeenCalledOnce();
  });

  it("leaves full screen when already in it, and the video's native full screen too", async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    expect(await toggleFullscreen(box(), vid(), doc({ fullscreenElement: {}, exitFullscreen }))).toBe("exit");
    expect(exitFullscreen).toHaveBeenCalledOnce();
    const webkitExitFullscreen = vi.fn();
    expect(await toggleFullscreen(box(), vid({ webkitDisplayingFullscreen: true, webkitExitFullscreen }), doc())).toBe("exit");
    expect(webkitExitFullscreen).toHaveBeenCalledOnce();
  });

  it("never throws: nothing supported, or the browser refuses", async () => {
    expect(await toggleFullscreen(box(), vid(), doc())).toBe("unsupported");
    expect(await toggleFullscreen(null, null, doc())).toBe("unsupported");
    const requestFullscreen = vi.fn().mockRejectedValue(new Error("denied"));
    expect(await toggleFullscreen(box({ requestFullscreen }), vid(), doc())).toBe("unsupported");
  });
});
