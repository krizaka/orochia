import { describe, expect, it } from "vitest";

import { conversationPath, MESSAGES_PATH, parseConversationId } from "./conversation-path";

const ID = "0b3f6c1e-8a64-4f7e-9d2a-5c1e7b9a4d10";

describe("conversation addresses (the URL is the state, and the universal link)", () => {
  it("names a conversation by its path", () => {
    expect(conversationPath(ID)).toBe(`/messages/${ID}`);
    expect(conversationPath(null)).toBe(MESSAGES_PATH);
  });
  it("accepts only a conversation id", () => {
    expect(parseConversationId(ID)).toBe(ID);
    expect(parseConversationId(ID.toUpperCase())).toBe(ID);
    expect(parseConversationId("../etc")).toBeNull();
    expect(parseConversationId("abc")).toBeNull();
    expect(parseConversationId(undefined)).toBeNull();
  });
});
