import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HERO_STEPS, VISITOR_SECTIONS } from "../../lib/visitor-home";

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
    const page = read("../../app/(home)/page.tsx");
    expect(page).toMatch(/!viewer && !asked/);
    expect(page).toContain("<VisitorHome");
    expect(page).toContain("FeedFilterTabs");
  });

  it("plays the real recordings of the app (the demo personas' journey), never a mock-up", () => {
    expect(HERO_STEPS.map((s) => s.clip)).toEqual(["alex-discover", "showcase", "alex-story", "elena-earnings"]);
    expect(read("./VisitorHome.tsx")).toContain("tourRecording");
  });

  it("previews the real feed, read from the database (feedPage), veiled as for any visitor", () => {
    const page = read("../../app/(home)/page.tsx");
    expect(page).toMatch(/feedPage\(\{ sort: FeedSort\.ForYou, viewerId: null, limit: PREVIEW_SIZE \}/);
    expect(read("./VisitorHome.tsx")).toContain("<VideoGrid");
  });

  it("has one primary action per section, and the flamingo's promise as the film says it", () => {
    const sections = read("./VisitorHome.tsx").split(/\bid="(?:hero|preview|how|creators|closing)"/).slice(1);
    for (const s of sections) expect((s.match(/variant="primary"/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(messages.home.visitor.flamingo).toBe("The flamingo answers, and the payment follows.");
  });
});
