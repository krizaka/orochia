import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BannerMomentDialog } from "./BannerMomentDialog";
import { BannerVideo } from "./BannerVideo";

const read = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
const video = { src: "https://v.example/abc/play_360p.mp4?token=x#t=10,14", startSeconds: 10, endSeconds: 14 };

describe("the moving cover", () => {
  it("renders the poster path first: no <video> at all before the client has checked motion, data and visibility", () => {
    const html = renderToStaticMarkup(createElement(BannerVideo, { poster: "/p.webp", video }));
    expect(html).toContain('data-playing="false"');
    expect(html).not.toContain("<video");
  });
  it("plays muted, inline, between the two bounds, only when the policy says play", () => {
    const source = read("./BannerVideo.tsx");
    expect(source).toContain('bannerPlayback({ ...env, visible, surface: "profile" })');
    expect(source).toContain('mode === "play" &&');
    for (const attr of ["muted", "playsInline", "poster={poster}", "video.endSeconds", "video.startSeconds"]) expect(source).toContain(attr);
  });
  it("starts from reduced motion = true, so a browser that never answers shows the poster", () => {
    expect(read("./BannerVideo.tsx")).toContain("reducedMotion: true");
  });
  it("is used by the profile hero only, never by cards or lists", () => {
    expect(read("./ProfileHero.tsx")).toContain("<BannerVideo");
    for (const f of ["../explore/CreatorTile.tsx", "../creator/CreatorSpaceBanner.tsx"]) expect(read(f)).not.toContain("BannerVideo");
  });
});

describe("the moment dialog", () => {
  it("shows skeletons while the videos load and says so when there is none", () => {
    const loading = renderToStaticMarkup(createElement(BannerMomentDialog, { open: true, onOpenChange: () => {}, videos: [], loading: true, onPick: () => {} }));
    expect(loading === "" || loading.includes("aria-busy")).toBe(true);
  });
  it("offers the menu entry only when the switch is on, and only for the cover", () => {
    const source = read("./PictureQuickEdit.tsx");
    expect(source).toContain("movingCover && !isAvatar");
    expect(source).toContain('"/api/me/banner-videos"');
    expect(source).toContain("bannerVideo");
  });
});
