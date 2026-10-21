import { describe, expect, it } from "vitest";

import { isConversationReport, moderationBody } from "./conversation-moderation";

describe("a report about a conversation", () => {
  it("is recognised by the message it names", () => {
    expect(isConversationReport({ messageId: "m1", videoId: null })).toBe(true);
    expect(isConversationReport({ messageId: null, videoId: "v1" })).toBe(false);
    expect(isConversationReport({ messageId: null, videoId: null })).toBe(false);
  });
  it("turns an operator's decision into the API body", () => {
    expect(moderationBody("remove_message", "m1")).toEqual({ action: "remove_message", messageId: "m1" });
    expect(moderationBody("remove_member", "u1")).toEqual({ action: "remove_member", userId: "u1" });
    expect(moderationBody("archive", "")).toEqual({ action: "archive" });
  });
  it("refuses an action it does not know", () => {
    expect(() => moderationBody("delete_everything", "x")).toThrow();
  });
});
