import { describe, expect, it } from "vitest";

import { contextRange, MODERATION_ACTIONS, NEIGHBOUR_WINDOW } from "./conversation-moderation-rules";

describe("moderation reads the reported message and its neighbours, never a whole group", () => {
  it("is ten messages either side", () => {
    expect(NEIGHBOUR_WINDOW).toBe(10);
    expect(contextRange(100)).toEqual({ from: 90, to: 110 });
  });
  it("never goes below the first message", () => {
    expect(contextRange(4)).toEqual({ from: 1, to: 14 });
  });
  it("offers three actions", () => {
    expect(MODERATION_ACTIONS).toEqual(["remove_message", "remove_member", "archive"]);
  });
});
