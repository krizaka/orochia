import { describe, expect, it } from "vitest";

import { bottomNavLeaf } from "./bottom-nav";

describe("the phone bar's fourth tab", () => {
  it("is Messages (with the unread badge) once signed in", () => {
    expect(bottomNavLeaf(true)).toBe("messages");
  });
  it("is Saved for a visitor, who has no messages to find", () => {
    expect(bottomNavLeaf(false)).toBe("saved");
  });
});
