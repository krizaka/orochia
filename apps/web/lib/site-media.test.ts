import { describe, expect, it } from "vitest";

import { HERO_CLIP } from "./visitor-home";
import { JOURNEY, WAYS } from "./how-it-works";
import { LOCALES } from "./locales";
import { CREATOR_CLIPS, FAN_CLIPS, HOME_TAKE, SHOWCASE_CLIP, siteMedia, type TourClip, tourRecording, WATCH_CLIP } from "./site-media";

const ALL: TourClip[] = [...FAN_CLIPS, ...CREATOR_CLIPS, SHOWCASE_CLIP, WATCH_CLIP, HOME_TAKE];

describe("site recordings", () => {
  it("point at the Bunny CDN with a content hash in the name, in the reader's language", () => {
    expect(siteMedia("products/orochia/tour/fr/alex-bid.mp4")).toMatch(/^https:\/\/krizaka-assets\.b-cdn\.net\/site\/products\/orochia\/tour\/fr\/alex-bid\.[0-9a-f]{10}\.mp4$/);
  });

  it("know every clip of the tour in its three files, for every language", () => {
    for (const locale of LOCALES) {
      for (const id of ALL) {
        const r = tourRecording(id, locale);
        expect([r.webm, r.mp4, r.poster].every((u) => u.startsWith("https://") && u.includes(`/tour/${locale}/${id}.`))).toBe(true);
      }
    }
  });

  it("gives each language its own files (no French page plays the English interface)", () => {
    for (const id of ALL) {
      const [en, fr] = [tourRecording(id, "en"), tourRecording(id, "fr")];
      expect(en.mp4).not.toBe(fr.mp4);
      expect(en.poster).not.toBe(fr.poster);
    }
  });

  it("covers every step of the home and of /how-it-works, in en and fr", () => {
    for (const clip of [HERO_CLIP, ...JOURNEY.map((s) => s.clip), ...WAYS.map((w) => w.clip)]) {
      for (const locale of LOCALES) expect(() => tourRecording(clip, locale)).not.toThrow();
    }
  });

  it("keeps no recording of the old interface at the root of tour/", () => {
    expect(() => siteMedia("products/orochia/tour/alex-bid.mp4")).toThrow();
    expect(() => siteMedia("products/orochia/tour/showcase.mp4")).toThrow();
  });

  it("refuses a path it does not know", () => {
    expect(() => siteMedia("products/orochia/tour/nope.mp4")).toThrow();
  });
});
