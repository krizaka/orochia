import { describe, expect, it } from "vitest";

import { missingStaticPages, STATIC_PAGES } from "./check-static-pages.mjs";

const all = Object.fromEntries(["en", "fr"].flatMap((l) => STATIC_PAGES.map((p) => [`/${l}${p}`, {}])));

describe("the pages that stay static", () => {
  it("passes when every public page is prerendered in each language", () => {
    expect(missingStaticPages({ routes: all })).toEqual([]);
  });
  it("names a page that reads the request and so is no longer prerendered", () => {
    const { "/fr/legal/terms": _gone, ...rest } = all;
    expect(missingStaticPages({ routes: rest })).toEqual(["/fr/legal/terms"]);
  });
});
