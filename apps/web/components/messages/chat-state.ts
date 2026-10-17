import type { ChatMessage, Conversation, ServerMessage } from "./types";

/**
 * The Messages state changes, as pure functions (tested): what a live event does to the thread on screen and to the
 * conversation list. Messages are unique by id — and by `clientId`, so the stored copy replaces the one this app
 * showed while sending — and ordered by `seq` (messages still on their way stay last, in the order they were typed).
 */

const LOCAL_SEQ = Number.MAX_SAFE_INTEGER;

export function mergeMessages(current: ChatMessage[], incoming: (ServerMessage | ChatMessage)[]): ChatMessage[] {
  const out: ChatMessage[] = [...current];
  for (const m of incoming as ChatMessage[]) {
    const i = out.findIndex((o) => o.id === m.id || (m.clientId !== null && o.clientId === m.clientId));
    if (i < 0) {
      out.push(m);
      continue;
    }
    const previous = out[i];
    // A stored message always wins over the local copy; between two stored copies, the most advanced receipt wins.
    if (!previous.local && m.local) continue;
    out[i] = previous.local || m.local
      ? m
      : { ...m, isRead: previous.isRead || m.isRead, deliveredAt: m.deliveredAt ?? previous.deliveredAt, readAt: m.readAt ?? previous.readAt };
  }
  return out.sort((a, b) => {
    const sa = a.local ? LOCAL_SEQ : a.seq;
    const sb = b.local ? LOCAL_SEQ : b.seq;
    return sa !== sb ? sa - sb : a.createdAt.localeCompare(b.createdAt);
  });
}

/** The sender's messages of a conversation up to `upTo` reached `state`. */
export function applyReceipt(messages: ChatMessage[], myId: string, receipt: { state: "delivered" | "read"; upTo: number; at: string }): ChatMessage[] {
  let changed = false;
  const next = messages.map((m) => {
    if (m.local || m.senderId !== myId || m.seq > receipt.upTo) return m;
    if (receipt.state === "read" && !m.isRead) {
      changed = true;
      return { ...m, isRead: true, readAt: receipt.at, deliveredAt: m.deliveredAt ?? receipt.at };
    }
    if (receipt.state === "delivered" && !m.deliveredAt) {
      changed = true;
      return { ...m, deliveredAt: receipt.at };
    }
    return m;
  });
  return changed ? next : messages;
}

/**
 * A message arrived or left (from any of the account's apps): the conversation moves to the top with it as its last
 * message, and counts one more unread when it is addressed to the viewer and not being read right now.
 * Returns null when the conversation is not in the list (the caller reloads it).
 */
export function applyMessageToList(list: Conversation[], message: ServerMessage, myId: string, readingNow: boolean): Conversation[] | null {
  const index = list.findIndex((c) => c.id === message.conversationId);
  if (index < 0) return null;
  const conversation = list[index];
  if (conversation.lastMessage && conversation.lastMessage.seq >= message.seq) return list;
  const incoming = message.senderId !== myId;
  const updated: Conversation = {
    ...conversation,
    lastMessageAt: message.createdAt,
    lastMessage: {
      id: message.id,
      seq: message.seq,
      content: message.content,
      senderId: message.senderId,
      storyId: message.storyId,
      createdAt: message.createdAt,
      deliveredAt: message.deliveredAt,
      isRead: message.isRead,
    },
    unreadCount: incoming && !readingNow ? conversation.unreadCount + 1 : conversation.unreadCount,
  };
  return [updated, ...list.slice(0, index), ...list.slice(index + 1)];
}

export function applyReceiptToList(list: Conversation[], myId: string, receipt: { conversationId: string; state: "delivered" | "read"; upTo: number; at: string }): Conversation[] {
  return list.map((c) => {
    const last = c.lastMessage;
    if (c.id !== receipt.conversationId || !last || last.senderId !== myId || last.seq > receipt.upTo) return c;
    return { ...c, lastMessage: { ...last, deliveredAt: last.deliveredAt ?? receipt.at, isRead: last.isRead || receipt.state === "read" } };
  });
}

/** The viewer read a conversation (on this app or another one). */
export function markListRead(list: Conversation[], conversationId: string): Conversation[] {
  return list.map((c) => (c.id === conversationId && c.unreadCount > 0 ? { ...c, unreadCount: 0 } : c));
}

/** Day separators: "Today", "Yesterday" or the date, in the viewer's time zone. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
