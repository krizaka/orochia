import { describe, expect, it } from "vitest";

import { activeTab, tabHref } from "./tab-href";

describe("tabs in the address", () => {
  it("the default tab is the bare path, the others carry ?tab=", () => {
    expect(tabHref("/auctions", "open", "open")).toBe("/auctions");
    expect(tabHref("/auctions", "sold", "open")).toBe("/auctions?tab=sold");
    expect(tabHref("/challenges", "open calls", "open")).toBe("/challenges?tab=open%20calls");
  });
  it("a tab the viewer may not have falls back to the default", () => {
    expect(activeTab("selling", ["open", "sold"], "open")).toBe("open");
    expect(activeTab("sold", ["open", "sold"], "open")).toBe("sold");
    expect(activeTab(undefined, ["open"], "open")).toBe("open");
  });
});
