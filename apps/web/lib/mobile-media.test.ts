import { describe, expect, it, vi } from "vitest";

import { MobileStepCard } from "@/components/mobile/MobileStepCard";

import { toolsFor } from "./i18n";
import { serverHtmlIn } from "./i18n-test-utils";

vi.mock("@/lib/i18n-server", () => import("./i18n-test-server"));

const { messages } = toolsFor("en");
import { MOBILE_STEPS, mobileClip } from "./mobile-media";

const CDN = /^https:\/\/krizaka-assets\.b-cdn\.net\/site\/products\/orochia\/mobile\/[a-z0-9-]+\.[0-9a-f]{10}\.(webm|mp4|webp)$/;

describe("the mobile journey", () => {
  it("is a few clear steps in the order a fan meets them, the 18+ gate first", () => {
    expect(MOBILE_STEPS).toEqual(["age-gate", "feed-stories", "unlock", "challenge-auction"]);
  });

  it("points every step at the CDN under products/orochia/mobile, with a content hash", () => {
    for (const id of MOBILE_STEPS) {
      const c = mobileClip(id);
      expect([c.webm, c.mp4, c.poster].every((u) => CDN.test(u))).toBe(true);
    }
  });

  it("has a goal, a purpose, an alt and three things to notice for every step", () => {
    const m = messages("mobile");
    expect(Object.keys(m.steps).sort()).toEqual([...MOBILE_STEPS].sort());
    for (const id of MOBILE_STEPS) {
      const s = m.steps[id];
      for (const text of [s.goal, s.short, s.purpose, s.alt]) expect(text.trim().length).toBeGreaterThan(0);
      expect(s.notice).toHaveLength(3);
    }
  });

  it("never claims anything is live", () => {
    expect(JSON.stringify(messages("mobile")).toLowerCase()).not.toMatch(/\blive\b/);
  });

  it("renders a step with its recording (on demand, with a text alternative), purpose and things to notice", async () => {
    const html = await serverHtmlIn("en", MobileStepCard, { id: "unlock" as const, index: 2 });
    const s = messages("mobile").steps.unlock;
    expect(html).toContain('preload="none"');
    expect(html).not.toContain("autoplay");
    expect(html).toMatch(/aria-label="[^"]+"/);
    expect(html).toContain("<h3");
    expect(html).toContain(s.purpose);
    for (const n of s.notice) expect(html).toContain(n.replaceAll("\"", "&quot;"));
  });
});
