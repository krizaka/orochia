import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

// Owner edits in place (krizaka/orochia#227). Ownership is decided on the server; the page only obeys.
describe("the owner's view of a video", () => {
  it("is decided by the details API from the session and the row, never from the page", () => {
    const route = read("../../app/api/videos/[id]/details/route.ts");
    expect(route).toMatch(/const isOwner = viewer\?\.id === video\.creatorId/);
    expect(route).toContain("isOwner");
  });
  it("replaces 'Send a tip' on your own video and is drawn for nobody else", () => {
    const page = read("../../app/[locale]/watch/[id]/WatchClient.tsx");
    expect(page).toMatch(/details\.isOwner \? \(\s*<OwnerBar/);
    expect(page).toContain("setIsTipModalOpen(true)");
  });
  it("edits and deletes through routes whose queries match the owner", () => {
    const route = read("../../app/api/videos/[id]/route.ts");
    expect(route).toContain('requireUserWithRole(["CREATOR"])');
    expect(route.match(/eq\(videos\.creatorId, user\.id\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it("plays from the dashboard through the same signed stream as the watch page", () => {
    expect(read("../dashboard/PlayVideoSheet.tsx")).toContain("/api/videos/${id}/stream");
    expect(read("../dashboard/VideoManager.tsx")).toContain("<PlayVideoSheet");
  });
});
