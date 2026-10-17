import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HERO_CLIP, HERO_STEPS, TAKE_BEATS, TAKE_SECONDS, VISITOR_SECTIONS } from "../../lib/visitor-home";
import { beatAt } from "./HomeTour";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const messages = JSON.parse(read("../../messages/en.json")) as { home: { visitor: Record<string, unknown> } };

describe("a signed-out visitor's home tells one story", () => {
  it("in five sections: the promise with the real app, the real feed, how it works, the creator side, the way in", () => {
    expect(VISITOR_SECTIONS).toEqual(["hero", "preview", "how", "creators", "closing"]);
    const view = read("./VisitorHome.tsx");
    const at = VISITOR_SECTIONS.map((id) => view.indexOf(`id="${id}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("is shown only to a visitor who did not ask for a feed tab: members, and ?feed=…, get the feed", () => {
    const page = read("../../app/[locale]/(home)/page.tsx");
    expect(page).toMatch(/!viewer && !asked/);
    expect(page).toContain("<VisitorHome");
    expect(page).toContain("FeedFilterTabs");
  });

  it("plays the real recordings of the app (the demo personas' journey), never a mock-up", () => {
    expect(HERO_STEPS.map((s) => s.id)).toEqual(["find", "watch", "tip", "earn"]);
    expect(HERO_CLIP).toBe("home-phone");
    expect(read("./VisitorHome.tsx")).toContain("tourRecording");
    // One continuous take of the app on a phone, in a device frame over a blur of itself: never four stills or a browser window.
    expect(read("./HomeTour.tsx")).toContain('kind="phone"');
  });

  it("follows the take: every language has one beat per step, ascending, inside the take", () => {
    for (const beats of Object.values(TAKE_BEATS)) {
      expect(beats).toHaveLength(HERO_STEPS.length);
      expect(beats[0]).toBe(0);
      expect(beats.every((b, i) => i === 0 || b > beats[i - 1]!)).toBe(true);
      expect(beats.at(-1)!).toBeLessThan(TAKE_SECONDS);
    }
    expect(beatAt(TAKE_BEATS.en, 0)).toBe(0);
    expect(beatAt(TAKE_BEATS.en, TAKE_BEATS.en[2]! + 0.1)).toBe(2);
  });

  it("previews the real feed, read from the database (feedPage), veiled as for any visitor", () => {
    const preview = read("./VisitorPreview.tsx");
    expect(preview).toMatch(/feedPage\(\{ sort: FeedSort\.ForYou, viewerId: null, limit: PREVIEW_SIZE \}/);
    expect(preview).toContain("<VideoGrid");
  });

  it("paints the hero without waiting for the database: the preview streams in its own Suspense", () => {
    const page = read("../../app/[locale]/(home)/page.tsx");
    const visitor = page.match(/if \(!viewer && !asked\) \{[\s\S]*?\n {2}\}\n/)?.[0] ?? "";
    expect(visitor).toContain("<VisitorHome");
    expect(visitor).not.toMatch(/await /);
    expect(page.indexOf("if (!viewer && !asked)")).toBeLessThan(page.indexOf("await feedSettings"));
    expect(page).toMatch(/<Suspense fallback=\{<PreviewPending \/>\}>\s*<VisitorPreview \/>/);
  });

  it("has one primary action per section, and the flamingo's promise as the film says it", () => {
    const sections = read("./VisitorHome.tsx").split(/\bid="(?:hero|preview|how|creators|closing)"/).slice(1);
    for (const s of sections) expect((s.match(/variant="primary"/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(messages.home.visitor.flamingo).toBe("The flamingo answers, and the payment follows.");
  });

  it("loads its proof first: preconnects to the media CDN and preloads the first step's poster at high priority", () => {
    const view = read("./VisitorHome.tsx");
    expect(view).toMatch(/preconnect\(new URL\(take\.poster\)\.origin\)/);
    expect(view).toMatch(/<link rel="preload" as="image" href=\{take\.poster\} fetchPriority="high" \/>/);
  });
});
