import { describe, expect, it } from "vitest";

import { messages } from "./i18n";
import { MOBILE_CLIPS, MOBILE_SHOTS, mobileClip, mobileShot } from "./mobile-media";

const CDN = /^https:\/\/krizaka-assets\.b-cdn\.net\/site\/products\/orochia\/mobile\/[a-z0-9-]+\.[0-9a-f]{10}\.(webm|mp4|webp)$/;

describe("the mobile app recordings", () => {
  it("point at the CDN under products/orochia/mobile, with a content hash", () => {
    for (const id of MOBILE_CLIPS) {
      const c = mobileClip(id);
      expect([c.webm, c.mp4, c.poster].every((u) => CDN.test(u))).toBe(true);
    }
    for (const s of MOBILE_SHOTS) expect(mobileShot(s.id)).toMatch(CDN);
  });

  it("have a label and a caption for every clip and a caption for every screenshot", () => {
    const m = messages("mobile");
    for (const id of MOBILE_CLIPS) {
      expect(m.clips[id].label.length).toBeGreaterThan(0);
      expect(m.clips[id].caption.length).toBeGreaterThan(0);
    }
    for (const s of MOBILE_SHOTS) expect(m.shots[s.id].length).toBeGreaterThan(0);
  });

  it("never claims anything is live, and keeps the age gate in the series", () => {
    const text = JSON.stringify(messages("mobile")).toLowerCase();
    expect(text).not.toMatch(/\blive\b/);
    expect(MOBILE_CLIPS[0]).toBe("age-gate");
  });
});
