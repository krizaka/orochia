import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { isSkeleton, stillStats } from "./frame-quality.mjs";

const fixture = (name) => new URL(`./fixtures/${name}`, import.meta.url).pathname;

test("a loading skeleton (grey placeholder blocks) is told from content, even the darkest screen", async () => {
  expect(isSkeleton(await stillStats(fixture("frame-skeleton.jpg")))).toBe(true);
  expect(isSkeleton(await stillStats(fixture("frame-content.jpg")))).toBe(false);
  expect(isSkeleton(await stillStats(fixture("frame-content-dark.jpg")))).toBe(false);
});

test("a black frame is not content either", () => {
  expect(isSkeleton({ gradient: 0 })).toBe(true);
});

// The poster of the home's phone take (and the blurred backdrop behind the phone, which is the clip's poster blurred) must
// be a content frame: a skeleton poster showed grey blocks, and a flat grey box, until the clip played (2026-10-20).
const SITE_MEDIA = readFileSync(new URL("../apps/web/lib/site-media.ts", import.meta.url), "utf8");
for (const locale of ["en", "fr"]) {
  test(`the ${locale} poster of the manifest is not a skeleton frame`, async ({ skip }) => {
    const hash = new RegExp(`"products/orochia/tour/${locale}/home-phone\\.jpg": "([0-9a-f]{10})"`).exec(SITE_MEDIA)?.[1];
    expect(hash, "the poster is in the manifest").toBeTruthy();
    let bytes;
    try {
      const res = await fetch(`https://krizaka-assets.b-cdn.net/site/products/orochia/tour/${locale}/home-phone.${hash}.jpg`);
      expect(res.ok, `the poster is served (${res.status})`).toBe(true);
      bytes = Buffer.from(await res.arrayBuffer());
    } catch (error) {
      if (error?.name === "AssertionError") throw error;
      skip("the CDN is not reachable from here");
      return;
    }
    const file = join(mkdtempSync(join(tmpdir(), "poster-")), "poster.jpg");
    writeFileSync(file, bytes);
    const stats = await stillStats(file);
    expect(isSkeleton(stats), `the poster looks like a loading state (gradient ${stats.gradient})`).toBe(false);
  });
}
