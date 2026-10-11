import { describe, expect, it } from "vitest";

import { applyMessageToList, applyReceipt, applyReceiptToList, markListRead, mergeMessages } from "./chat-state";
import type { ChatMessage, Conversation } from "./types";

const me = "me";
const msg = (seq: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `m${seq}`,
  seq,
  clientId: null,
  conversationId: "c1",
  senderId: me,
  recipientId: "you",
  content: `#${seq}`,
  storyId: null,
  deliveredAt: null,
  isRead: false,
  readAt: null,
  createdAt: new Date(1_700_000_000_000 + seq * 1000).toISOString(),
  ...extra,
});

describe("the thread", () => {
  it("keeps one copy per message and orders by seq, whatever the arrival order (replay + live)", () => {
    const merged = mergeMessages([msg(2)], [msg(3), msg(1), msg(2), msg(3)]);
    expect(merged.map((m) => m.seq)).toEqual([1, 2, 3]);
  });

  it("replaces the copy shown while sending with the stored one (same clientId), wherever it arrives from", () => {
    const local = msg(0, { id: "local-x", clientId: "x", local: "sending", seq: 0 });
    const stored = msg(7, { clientId: "x" });
    const merged = mergeMessages([msg(5), local], [stored]);
    expect(merged.map((m) => m.id)).toEqual(["m5", "m7"]);
    expect(merged[1].local).toBeUndefined();
    // …and a late echo of the local copy never brings it back.
    expect(mergeMessages(merged, [local]).map((m) => m.id)).toEqual(["m5", "m7"]);
  });

  it("keeps messages still on their way last", () => {
    const merged = mergeMessages([], [msg(0, { id: "l1", clientId: "a", local: "sending" }), msg(9)]);
    expect(merged.map((m) => m.id)).toEqual(["m9", "l1"]);
  });

  it("never loses a receipt when an older copy arrives again", () => {
    const read = msg(4, { isRead: true, deliveredAt: "t", readAt: "t" });
    expect(mergeMessages([read], [msg(4)])[0].isRead).toBe(true);
  });

  it("applies delivered then read to the sender's messages up to the cursor only", () => {
    const thread = [msg(1), msg(2), msg(3, { senderId: "you", recipientId: me }), msg(4)];
    const delivered = applyReceipt(thread, me, { state: "delivered", upTo: 2, at: "t1" });
    expect(delivered.map((m) => Boolean(m.deliveredAt))).toEqual([true, true, false, false]);
    const read = applyReceipt(delivered, me, { state: "read", upTo: 4, at: "t2" });
    expect(read.map((m) => m.isRead)).toEqual([true, true, false, true]);
    expect(applyReceipt(read, me, { state: "read", upTo: 4, at: "t3" })).toBe(read);
  });
});

describe("the conversation list", () => {
  const conv = (id: string, unread = 0, last?: number): Conversation => ({
    id,
    lastMessageAt: "2026-01-01T00:00:00.000Z",
    otherUser: { id: "you", username: "you", displayName: "You", avatarUrl: null },
    lastMessage: last ? { id: `m${last}`, seq: last, content: "", senderId: me, storyId: null, createdAt: "", deliveredAt: null, isRead: false } : null,
    unreadCount: unread,
    blockedByMe: false,
  });

  it("moves the conversation to the top and counts an unread message for the recipient", () => {
    const list = [conv("a"), conv("c1", 1)];
    const next = applyMessageToList(list, msg(5, { senderId: "you", recipientId: me }), me, false)!;
    expect(next.map((c) => c.id)).toEqual(["c1", "a"]);
    expect(next[0].unreadCount).toBe(2);
    expect(next[0].lastMessage?.seq).toBe(5);
  });

  it("does not count what the viewer is reading now, nor their own messages, nor an older replay", () => {
    expect(applyMessageToList([conv("c1")], msg(5, { senderId: "you", recipientId: me }), me, true)![0].unreadCount).toBe(0);
    expect(applyMessageToList([conv("c1")], msg(5), me, false)![0].unreadCount).toBe(0);
    const list = [conv("c1", 0, 9)];
    expect(applyMessageToList(list, msg(5), me, false)).toBe(list);
  });

  it("asks for a reload when the conversation is new", () => {
    expect(applyMessageToList([conv("a")], msg(1), me, false)).toBeNull();
  });

  it("shows the last message seen, and clears the unread count when read elsewhere", () => {
    const list = applyReceiptToList([conv("c1", 0, 3)], me, { conversationId: "c1", state: "read", upTo: 3, at: "t" });
    expect(list[0].lastMessage?.isRead).toBe(true);
    expect(markListRead([conv("c1", 4)], "c1")[0].unreadCount).toBe(0);
  });
});
