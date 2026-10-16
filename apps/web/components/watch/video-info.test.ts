import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { creditOf } from "./VideoInfo";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("the video information", () => {
  it("quotes the Orazaka credit line, nothing else of the description", () => {
    expect(creditOf("A drone glide.\n\nMade with Orazaka — run ebb70c88 (Wan 2.2 A14B).")).toBe("Made with Orazaka — run ebb70c88 (Wan 2.2 A14B).");
    expect(creditOf("Just a description")).toBeNull();
    expect(creditOf(null)).toBeNull();
  });
  it("is fed by what Bunny read, kept on the row at READY by the webhook and by reconciliation", () => {
    expect(read("../../app/api/webhooks/bunny/route.ts")).toContain("update.framerate = details.framerate");
    expect(read("../../lib/video-reconcile.ts")).toContain("framerate:");
    expect(read("../../../../packages/db/src/schema/videos.ts")).toContain('framerate: real("framerate")');
  });
  it("shows on the watch page and as a quality badge on the cards", () => {
    expect(read("../../app/watch/[id]/WatchClient.tsx")).toContain("<VideoInfo");
    expect(read("../VideoCard.tsx")).toContain("QualityBadge");
  });
});
