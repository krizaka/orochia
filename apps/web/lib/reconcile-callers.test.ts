import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

// dev: a video uploaded through the API stayed PROCESSING for ever when nobody opened the creator's profile —
// the webhook is not guaranteed, so every place a creator (or their tooling) looks at their own uploads catches up.
describe("a lost Bunny webhook is caught up where a creator looks at their uploads", () => {
  it.each([
    ["the dashboard API (the creator's own uploads)", "../app/api/me/dashboard/route.ts"],
    ["the upload session", "../app/api/videos/create-upload-session/route.ts"],
    ["the public creator profile", "../app/[locale]/creators/[username]/page.tsx"],
    ["a video's own details (an upload polled by id never waited for a dashboard visit, orochia#277)", "../app/api/videos/[id]/details/route.ts"],
  ])("%s", (_name, file) => {
    expect(read(file)).toContain("reconcileVideos(");
  });
});

describe("the details route asks about that one video only", () => {
  it("passes the video id to reconcileVideos", () => {
    expect(read("../app/api/videos/[id]/details/route.ts")).toMatch(/reconcileVideos\(\{[^}]*videoId:/);
    expect(read("./video-reconcile.ts")).toMatch(/videoId\?: string/);
  });
});
