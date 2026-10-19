// Dev preview `journey.core` (orochia#240): the pure rules of the journey replay.
import { describe, expect, it } from "vitest";

import { clipTitle, creatorShareCents, isHlsPlaylist, MOMENTS, requestIdOf, step, verdict } from "./journey-lib.mjs";

describe("the core journey on dev (scripts/journey-dev.mjs)", () => {
  it("keeps the edge's request id of a call, from a Headers or a plain object", () => {
    expect(requestIdOf(new Headers({ "cf-ray": "a4d31a792e5480f3-YUL" }))).toBe("a4d31a792e5480f3-YUL");
    expect(requestIdOf({ "x-request-id": "req-1" })).toBe("req-1");
    expect(requestIdOf(new Headers())).toBeNull();
  });

  it("computes the creator's share of a tip from the platform fee (90 % at the default fee)", () => {
    expect(creatorShareCents(100, 10)).toBe(90);
    expect(creatorShareCents(500, 10)).toBe(450);
    expect(creatorShareCents(333, 10)).toBe(300);
  });

  it("is proven only with the five moments, each ok", () => {
    const ok = MOMENTS.map((name) => step(name, { ok: true, status: 200 }));
    expect(verdict(ok)).toEqual({ proven: true, missing: [], failed: [] });
    expect(verdict(ok.slice(0, 4)).missing).toEqual(["earnings"]);
    expect(verdict([...ok.slice(0, 3), step("tip", { ok: false, status: 402 }), ok[4]]).failed).toEqual(["tip"]);
  });

  it("recognises an HLS playlist, and refuses an HTML error page", () => {
    expect(isHlsPlaylist("#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nv.m3u8")).toBe(true);
    expect(isHlsPlaylist("<html>403</html>")).toBe(false);
    expect(isHlsPlaylist("#EXTM3U\n")).toBe(false);
  });

  it("names the synthetic clip for what it is, with the date", () => {
    expect(clipTitle(new Date("2026-10-19T22:30:00Z"))).toBe("Journey check 2026-10-19 22:30Z (synthetic test clip)");
  });
});
