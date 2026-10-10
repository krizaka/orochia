import { describe, expect, it } from "vitest";

import {
  autoAdvances,
  blockedByAutoplayPolicy,
  classifyGesture,
  findStory,
  imageProgress,
  nextCreator,
  nextPosition,
  playbackError,
  previousCreator,
  previousPosition,
  rememberSound,
  shortcut,
  soundOn,
  startOf,
  storyAge,
  videoProgress,
} from "./story-player";

const sizes = [2, 1, 3];

describe("navigation", () => {
  it("walks a ring, then the next one, then closes after the last story", () => {
    expect(nextPosition(sizes, { ring: 0, story: 0 })).toEqual({ ring: 0, story: 1 });
    expect(nextPosition(sizes, { ring: 0, story: 1 })).toEqual({ ring: 1, story: 0 });
    expect(nextPosition(sizes, { ring: 2, story: 2 })).toBeNull();
  });

  it("goes back inside a ring, then to the previous ring's last story, and stays at the very start", () => {
    expect(previousPosition(sizes, { ring: 2, story: 1 })).toEqual({ ring: 2, story: 0 });
    expect(previousPosition(sizes, { ring: 1, story: 0 })).toEqual({ ring: 0, story: 1 });
    expect(previousPosition(sizes, { ring: 0, story: 0 })).toEqual({ ring: 0, story: 0 });
  });

  it("jumps between creators (a sideways swipe), skipping empty rings", () => {
    expect(nextCreator([1, 0, 2], { ring: 0, story: 0 })).toEqual({ ring: 2, story: 0 });
    expect(nextCreator(sizes, { ring: 2, story: 0 })).toBeNull();
    expect(previousCreator(sizes, { ring: 2, story: 2 })).toEqual({ ring: 1, story: 0 });
    expect(previousCreator(sizes, { ring: 0, story: 1 })).toEqual({ ring: 0, story: 0 });
  });

  it("opens a ring on its first unseen story, and finds a story from the address", () => {
    expect(startOf([{ seen: true }, { seen: false }])).toBe(1);
    expect(startOf([{ seen: true }, { seen: true }])).toBe(0);
    const rings = [{ stories: [{ id: "a" }] }, { stories: [{ id: "b" }, { id: "c" }] }];
    expect(findStory(rings, "c")).toEqual({ ring: 1, story: 1 });
    expect(findStory(rings, "gone")).toBeNull();
  });
});

describe("gestures", () => {
  const base = { width: 400, dx: 0, dy: 0, ms: 80 };
  it("a tap on the left part goes back, elsewhere goes on", () => {
    expect(classifyGesture({ ...base, x: 50 })).toBe("previous");
    expect(classifyGesture({ ...base, x: 200 })).toBe("next");
    expect(classifyGesture({ ...base, x: 390 })).toBe("next");
  });
  it("a long press is a pause, not a tap", () => {
    expect(classifyGesture({ ...base, x: 300, ms: 600 })).toBe("none");
  });
  it("a drag down closes; a drag sideways changes creator", () => {
    expect(classifyGesture({ ...base, x: 200, dy: 140, dx: 20 })).toBe("close");
    expect(classifyGesture({ ...base, x: 200, dx: -120, dy: 10 })).toBe("nextCreator");
    expect(classifyGesture({ ...base, x: 200, dx: 120, dy: 10 })).toBe("previousCreator");
    expect(classifyGesture({ ...base, x: 200, dx: 30, dy: 30 })).toBe("none");
  });
});

describe("progress and auto-advance", () => {
  it("images run six seconds; videos follow their clock", () => {
    expect(imageProgress(3000)).toBe(50);
    expect(imageProgress(9000)).toBe(100);
    expect(imageProgress(-5)).toBe(0);
    expect(videoProgress(2, 8)).toBe(25);
    expect(videoProgress(1, Number.NaN)).toBe(0);
  });
  it("never moves on by itself under reduced motion", () => {
    expect(autoAdvances(false)).toBe(true);
    expect(autoAdvances(true)).toBe(false);
  });
});

describe("sound", () => {
  function memory() {
    const data = new Map<string, string>();
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  }
  it("plays with sound unless muted earlier in the session", () => {
    const store = memory();
    expect(soundOn(store)).toBe(true);
    rememberSound(store, false);
    expect(soundOn(store)).toBe(false);
    rememberSound(store, true);
    expect(soundOn(store)).toBe(true);
  });
  it("survives a blocked storage", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(soundOn(broken)).toBe(true);
    expect(() => rememberSound(broken, false)).not.toThrow();
    expect(soundOn(null)).toBe(true);
  });
  it("recognises the browser's autoplay refusal", () => {
    expect(blockedByAutoplayPolicy({ name: "NotAllowedError" })).toBe(true);
    expect(blockedByAutoplayPolicy(new Error("other"))).toBe(false);
    expect(blockedByAutoplayPolicy(undefined)).toBe(false);
  });
});

describe("playback errors", () => {
  it("names a CDN refusal as such", () => {
    expect(playbackError({ type: "networkError", responseCode: 403 })).toBe("denied");
    expect(playbackError({ type: "networkError", responseCode: 401 })).toBe("denied");
    expect(playbackError({ type: "networkError", responseCode: 404 })).toBe("missing");
    expect(playbackError({ type: "networkError", responseCode: 0 })).toBe("network");
    expect(playbackError({ type: "networkError", responseCode: 502 })).toBe("network");
    expect(playbackError({ type: "mediaError" })).toBe("media");
    expect(playbackError({ mediaErrorCode: 2 })).toBe("network");
  });
});

describe("keyboard", () => {
  it("maps the viewer's keys and ignores them while typing a reply", () => {
    expect(shortcut("ArrowLeft", false)).toBe("previous");
    expect(shortcut("ArrowRight", false)).toBe("next");
    expect(shortcut(" ", false)).toBe("togglePause");
    expect(shortcut("m", false)).toBe("toggleSound");
    expect(shortcut("M", false)).toBe("toggleSound");
    expect(shortcut("m", true)).toBeNull();
    expect(shortcut("x", false)).toBeNull();
  });
});

describe("age", () => {
  it("minutes under an hour, then hours (at most 24)", () => {
    const now = Date.parse("2026-10-09T12:00:00Z");
    expect(storyAge("2026-10-09T11:55:00Z", now)).toEqual({ unit: "m", value: 5 });
    expect(storyAge("2026-10-09T05:00:00Z", now)).toEqual({ unit: "h", value: 7 });
    expect(storyAge("2026-10-08T00:00:00Z", now)).toEqual({ unit: "h", value: 24 });
  });
});
