import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { loadReleases } from "./changelog";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

afterEach(() => vi.unstubAllGlobals());

describe("/changelog", () => {
  it("reads the merged pull requests into weeks, the latest first, housekeeping left out", async () => {
    const pulls = [
      { title: "feat(chat): voice replies (#12)", html_url: "https://github.com/krizaka/orochia/pull/12", merged_at: "2026-10-16T10:00:00Z" },
      { title: "chore: bump", html_url: "https://github.com/krizaka/orochia/pull/13", merged_at: "2026-10-16T11:00:00Z" },
      { title: "fix: XSS in the export (#9)", html_url: "https://github.com/krizaka/orochia/pull/9", merged_at: "2026-10-07T10:00:00Z" },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(pulls))));
    const releases = await loadReleases();
    expect(releases.map((r) => r.version)).toEqual(["2026-10-12", "2026-10-05"]);
    expect(releases[0].changes.map((c) => c.tag)).toEqual(["feature"]);
    expect(releases[1].changes[0].tag).toBe("security");
  });

  it("is empty, not broken, when GitHub cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 403 })));
    expect(await loadReleases()).toEqual([]);
  });

  it("has its route, its feed and its words in both languages", () => {
    expect(read("app/[locale]/changelog/page.tsx")).toContain("<ChangelogBody");
    expect(read("app/[locale]/changelog/page.tsx")).toContain("await loadReleases()");
    expect(read("app/[locale]/changelog/feed.xml/route.ts")).toContain("changelogRss");
    expect(read("app/sitemap.ts")).toContain('"/changelog"');
    for (const m of [en, fr]) {
      expect(m.changelog.title).toBeTruthy();
      expect(m.changelog.kinds.security).toBeTruthy();
    }
  });

  it("the footer's version links /changelog#<version>, the page owns that anchor", () => {
    expect(read("components/SiteFooter.tsx")).toContain("`${changelog}#${BUILD_INFO.version}`");
    expect(read("components/ChangelogBody.tsx")).toContain("<span id={version}>");
    expect(read("app/[locale]/changelog/page.tsx")).toContain("version={BUILD_INFO.version}");
  });
});
