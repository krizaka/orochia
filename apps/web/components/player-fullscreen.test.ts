import { describe, expect, it, vi } from "vitest";

import { enterFullscreen, exitFullscreen, isFullscreen, type FullscreenDocument, type FullscreenTarget, type FullscreenVideo } from "./player-fullscreen";

const doc = (over: Partial<FullscreenDocument> = {}): FullscreenDocument => ({ ...over });

describe("entering fullscreen", () => {
  it("fullscreens the container where the browser allows it (desktop, Android, iPadOS)", async () => {
    const container: FullscreenTarget = { requestFullscreen: vi.fn().mockResolvedValue(undefined) };
    const video: FullscreenVideo = { webkitEnterFullscreen: vi.fn() };
    expect(await enterFullscreen(video, container, doc())).toBe("container");
    expect(container.requestFullscreen).toHaveBeenCalledOnce();
    expect(video.webkitEnterFullscreen).not.toHaveBeenCalled();
  });

  it("falls back to the video's own fullscreen on iPhone, where the container cannot be fullscreened", async () => {
    const container: FullscreenTarget = {};
    const video: FullscreenVideo = { webkitEnterFullscreen: vi.fn(), webkitSupportsFullscreen: true };
    expect(await enterFullscreen(video, container, doc())).toBe("video");
    expect(video.webkitEnterFullscreen).toHaveBeenCalledOnce();
  });

  it("uses the prefixed container API (older WebKit) before the video", async () => {
    const container: FullscreenTarget = { webkitRequestFullscreen: vi.fn() };
    const video: FullscreenVideo = { webkitEnterFullscreen: vi.fn() };
    expect(await enterFullscreen(video, container, doc())).toBe("container");
    expect(container.webkitRequestFullscreen).toHaveBeenCalledOnce();
  });

  it("falls back to the video when the container request is refused", async () => {
    const container: FullscreenTarget = { requestFullscreen: vi.fn().mockRejectedValue(new TypeError("denied")) };
    const video: FullscreenVideo = { webkitEnterFullscreen: vi.fn() };
    expect(await enterFullscreen(video, container, doc())).toBe("video");
  });

  it("reports nothing when no API exists", async () => {
    expect(await enterFullscreen({}, {}, doc())).toBe("none");
  });
});

describe("leaving fullscreen", () => {
  it("exits the document's fullscreen element", async () => {
    const d = doc({ fullscreenElement: {} as Element, exitFullscreen: vi.fn().mockResolvedValue(undefined) });
    await exitFullscreen({}, d);
    expect(d.exitFullscreen).toHaveBeenCalledOnce();
  });

  it("exits the video's native fullscreen on iPhone", async () => {
    const video: FullscreenVideo = { webkitDisplayingFullscreen: true, webkitExitFullscreen: vi.fn() };
    await exitFullscreen(video, doc());
    expect(video.webkitExitFullscreen).toHaveBeenCalledOnce();
  });
});

describe("knowing whether it is fullscreen", () => {
  it("sees the standard and prefixed document elements and the video's native state", () => {
    expect(isFullscreen({}, doc())).toBe(false);
    expect(isFullscreen({}, doc({ fullscreenElement: {} as Element }))).toBe(true);
    expect(isFullscreen({}, doc({ webkitFullscreenElement: {} as Element }))).toBe(true);
    expect(isFullscreen({ webkitDisplayingFullscreen: true }, doc())).toBe(true);
  });
});
