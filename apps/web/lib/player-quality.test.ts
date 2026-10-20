import { describe, expect, it } from "vitest";

import {
  applyQuality,
  AUTO,
  choiceFromStorage,
  type HlsLike,
  levelOptions,
  menuKeyStep,
  nominalLines,
  parseMasterPlaylist,
  qualityBadge,
  readStoredQuality,
  storeQuality,
} from "./player-quality";

const L = (width: number, height: number, bitrate = width * height) => ({ width, height, bitrate });
// What Bunny's master playlist holds for the reference film (16:9, 240p → 1080p).
const LANDSCAPE = [L(426, 240), L(640, 360), L(854, 480), L(1280, 720), L(1920, 1080)];
// A 9:16 clip: the level's `height` is the long side; Bunny (and the viewer) name a rendition by the short side.
const PORTRAIT = [L(240, 426), L(360, 640), L(720, 1280), L(1080, 1920)];

describe("the names of the renditions", () => {
  it("snaps a rendition's real short side to the standard rung Bunny names it by (198 → 240, 474 → 480, 704 → 720)", () => {
    expect([198, 240, 360, 474, 480, 704, 720, 1080, 2160].map(nominalLines)).toEqual([240, 240, 360, 480, 480, 720, 720, 1080, 2160]);
    expect(nominalLines(1000)).toBe(1080);
    expect(nominalLines(100)).toBe(100); // far from every rung: the size itself
  });
  it("names the levels of a 4K clip's ladder by their rung, never by an odd number", () => {
    expect(levelOptions([L(352, 198), L(844, 474), L(1280, 720), L(1920, 1080)]).map((o) => o.label)).toEqual(["Auto", "1080p", "720p", "480p", "240p"]);
  });
});

describe("the quality picker's options (levels → menu)", () => {
  it("is Auto first, then every rendition best to worst, labelled by the short side", () => {
    const options = levelOptions(LANDSCAPE);
    expect(options.map((o) => o.label)).toEqual(["Auto", "1080p", "720p", "480p", "360p", "240p"]);
    expect(options[0]).toMatchObject({ id: AUTO, level: -1 });
    expect(options[1]).toMatchObject({ id: "1080", level: 4 });
  });
  it("names a vertical clip's renditions by the short side too (9:16 1080×1920 is 1080p)", () => {
    expect(levelOptions(PORTRAIT).map((o) => o.label)).toEqual(["Auto", "1080p", "720p", "360p", "240p"]);
  });
  it("keeps one entry per height (the richest bitrate), with its own level index", () => {
    const options = levelOptions([L(1280, 720, 2_000_000), L(1280, 720, 3_000_000), L(1920, 1080, 6_000_000)]);
    expect(options.map((o) => o.label)).toEqual(["Auto", "1080p", "720p"]);
    expect(options.find((o) => o.id === "720")?.level).toBe(1);
  });
  it("badges only what is Full HD or above (a standing rule): never on 720p or below", () => {
    expect(qualityBadge(240)).toBeNull();
    expect(qualityBadge(720)).toBeNull();
    expect(qualityBadge(1071)).toBeNull();
    expect(qualityBadge(1080)).toBe("HD");
    expect(qualityBadge(1440)).toBe("QHD");
    expect(qualityBadge(2160)).toBe("4K");
    const options = levelOptions(LANDSCAPE);
    expect(options.filter((o) => o.badge).map((o) => o.label)).toEqual(["1080p"]);
  });
  it("offers nothing to pick when there is a single rendition (Auto only)", () => {
    expect(levelOptions([L(1920, 1080)]).map((o) => o.label)).toEqual(["Auto", "1080p"]);
    expect(levelOptions([])).toEqual([]);
  });
});

describe("the choice (menu → switch)", () => {
  function fakeHls(levels: ReturnType<typeof L>[]): HlsLike & { levels: ReturnType<typeof L>[] } {
    return { levels, currentLevel: -1, autoLevelEnabled: true };
  }
  it("switches the level at once to the chosen rendition, and back to Auto (-1)", () => {
    const hls = fakeHls(LANDSCAPE);
    const options = levelOptions(LANDSCAPE);
    applyQuality(hls, options.find((o) => o.id === "480")!);
    expect(hls.currentLevel).toBe(2);
    applyQuality(hls, options[0]!);
    expect(hls.currentLevel).toBe(-1);
  });
  it("remembers the choice for the session and reads it back as a level (the nearest at or below when the height is gone)", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    expect(readStoredQuality(storage)).toBe(AUTO);
    storeQuality(storage, "720");
    expect(readStoredQuality(storage)).toBe("720");
    const options = levelOptions(LANDSCAPE);
    expect(choiceFromStorage(options, "720")?.level).toBe(3);
    expect(choiceFromStorage(options, "1440")?.id).toBe("1080"); // the clip has no 1440p: the best it has below
    expect(choiceFromStorage(options, "144")?.id).toBe("240"); // nothing below: the lowest it has
    expect(choiceFromStorage(options, AUTO)?.level).toBe(-1);
  });
  it("never throws when storage is unavailable (private window, blocked)", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readStoredQuality(broken)).toBe(AUTO);
    expect(() => storeQuality(broken, "720")).not.toThrow();
    expect(readStoredQuality(null)).toBe(AUTO);
  });
});

describe("the menu's keyboard", () => {
  it("moves with the arrows (wrapping), Home and End; anything else does nothing", () => {
    expect(menuKeyStep("ArrowDown", 0, 4)).toBe(1);
    expect(menuKeyStep("ArrowDown", 3, 4)).toBe(0);
    expect(menuKeyStep("ArrowUp", 0, 4)).toBe(3);
    expect(menuKeyStep("Home", 2, 4)).toBe(0);
    expect(menuKeyStep("End", 1, 4)).toBe(3);
    expect(menuKeyStep("a", 1, 4)).toBeNull();
  });
});

describe("iPhone Safari's native HLS (no level API): the master playlist's own renditions", () => {
  const MASTER = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=640x360",
    "360p/video.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080,CODECS=\"avc1.640028\"",
    "1080p/video.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720",
    "720p/video.m3u8",
  ].join("\n");
  it("reads the variants and resolves their addresses against the signed master URL (the token path stays)", () => {
    const base = "https://vz.b-cdn.net/bcdn_token=abc&expires=1&token_path=%2Fg%2F/g/playlist.m3u8";
    const variants = parseMasterPlaylist(MASTER, base);
    expect(variants.map((v) => v.height)).toEqual([1080, 720, 360]);
    expect(variants[0]!.url).toBe("https://vz.b-cdn.net/bcdn_token=abc&expires=1&token_path=%2Fg%2F/g/1080p/video.m3u8");
  });
  it("reads nothing from something that is not a master playlist", () => {
    expect(parseMasterPlaylist("#EXTM3U\n#EXTINF:4,\nseg0.ts", "https://x/y.m3u8")).toEqual([]);
  });
});
