import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { viewAsOf } from "./view-as";

describe("« View as the public » on your own page (orochia#263)", () => {
  it("is for the owner only: anyone else never gets a preview, whatever the address says", () => {
    expect(viewAsOf("public", true)).toBe("public");
    expect(viewAsOf("public", false)).toBeNull();
  });

  it("knows one audience for now, and ignores everything else", () => {
    expect(viewAsOf(undefined, true)).toBeNull();
    expect(viewAsOf("", true)).toBeNull();
    expect(viewAsOf("admin", true)).toBeNull();
    expect(viewAsOf(["public", "public"], true)).toBeNull();
  });
});

describe("the profile page under « View as the public »", () => {
  const page = readFileSync(new URL("../app/[locale]/creators/[username]/page.tsx", import.meta.url), "utf8");

  it("reads the data as a visitor, draws no owner control, and says so in a banner with the way back", () => {
    expect(page).toContain("viewAsOf(");
    expect(page).toContain("const asVisitor = Boolean(preview)");
    expect(page).toMatch(/creatorVideos\(creator\.id, 24, asVisitor \? false : viewer\?\.isAgeVerified === true\)/);
    expect(page).toMatch(/visiblePlaylists\(creator\.id, asVisitor \? null : viewer\?\.id \?\? null\)/);
    expect(page).toContain('data-testid="view-as-banner"');
    expect(page).toContain("profile.viewAs.back");
  });

  it("offers the preview to the owner next to « Edit profile »", () => {
    expect(page).toContain("?as=public");
    expect(page).toContain("profile.viewAs.cta");
  });
});
