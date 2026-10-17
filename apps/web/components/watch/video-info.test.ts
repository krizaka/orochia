import { readFileSync } from "node:fs";
import React from "react";
import { describe, expect, it } from "vitest";

import { htmlIn } from "@/lib/i18n-test-utils";
import { parseAiCredit, shortRunId, withoutCredit } from "@/lib/ai-credit";

import { creditOf, VideoInfo } from "./VideoInfo";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const RUN = "6351addc-1f2e-4b7a-9c3d-0123456789ab";
const AI = `A drone glide.\n\nMade with Orazaka — run ${RUN} (wan2.2-ti2v-5b on NVIDIA H100 80GB HBM3).`;
const base = { width: 704, height: 1280, framerate: 24, durationSeconds: 5, createdAt: "2026-10-16T12:00:00Z", status: "READY" };
const html = (description: string | null, status = "READY") => htmlIn("en", React.createElement(VideoInfo, { video: { ...base, status, description } }));

describe("the video information", () => {
  it("quotes the Orazaka credit line, nothing else of the description", () => {
    expect(creditOf("A drone glide.\n\nMade with Orazaka — run ebb70c88 (Wan 2.2 A14B).")).toBe("Made with Orazaka — run ebb70c88 (Wan 2.2 A14B).");
    expect(creditOf("Just a description")).toBeNull();
    expect(creditOf(null)).toBeNull();
  });
  it("reads the run, the model and the hardware, truncates the run id, and drops the line from the description", () => {
    expect(parseAiCredit(AI)).toMatchObject({ runId: RUN, model: "wan2.2-ti2v-5b", hardware: "NVIDIA H100 80GB HBM3" });
    expect(shortRunId(RUN)).toBe("6351addc…");
    expect(withoutCredit(AI)).toBe("A drone glide.");
  });
  it("is one quiet meta line plus a disclosure: no grid of boxes, 'Ready' hidden", () => {
    const out = html(null);
    expect(out).toContain("HD 720p");
    expect(out).toContain("9:16");
    expect(out).toContain("0:05");
    expect(out).toContain("24 fps");
    expect(out).toContain("Oct 16, 2026");
    expect(out).toContain("<details");
    expect(out).not.toContain("border-border-subtle");
    expect(out).not.toContain("data-testid=\"video-status\"");
    expect(out).not.toContain("ai-badge");
  });
  it("is built on the Krizaka UI MetaRow, not a local flex line", () => {
    const src = read("./VideoInfo.tsx");
    expect(src).toContain('from "@krizaka/ui/meta-row"');
    expect(src).not.toContain("gap-x-2 gap-y-1.5");
    const out = html(AI);
    expect(out).toContain("<ul");
    expect(out).toContain('data-testid="video-meta"');
  });
  it("shows a status chip only when the encoding is not ready", () => {
    expect(html(null, "PROCESSING")).toContain("data-testid=\"video-status\"");
  });
  it("wears the AI badge on AI-generated videos", () => {
    expect(html(AI)).toContain("ai-badge");
    expect(html(AI)).toContain("AI-generated");
  });
  it("keeps the run id truncated with a copy button in the popover", () => {
    const src = read("./VideoInfo.tsx");
    expect(src).toContain("shortRunId(credit.runId)");
    expect(src).toContain("navigator.clipboard");
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
