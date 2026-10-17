/** What the Messages screens hold — the API's shapes (lib/messaging.ts) with dates as strings, plus local send states. */

import type { MessageOrigin } from "@/lib/message-origin";

export type PresenceState = "online" | "away" | "offline";

export interface PresenceView {
  state: PresenceState;
  lastSeenAt: string | null;
}

export interface Person {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
  lastMessageAt: string;
  otherUser: Person & { role?: string };
  lastMessage: {
    id: string;
    seq: number;
    content: string;
    senderId: string;
    storyId: string | null;
    createdAt: string;
    deliveredAt: string | null;
    isRead: boolean;
  } | null;
  unreadCount: number;
  blockedByMe: boolean;
  presence?: PresenceView;
}

export interface ServerMessage {
  id: string;
  seq: number;
  clientId: string | null;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  storyId: string | null;
  origin: MessageOrigin;
  deliveredAt: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

/** A message on screen: stored, or still on its way from this app (`sending`, `failed`). */
export interface ChatMessage extends ServerMessage {
  local?: "sending" | "failed";
  error?: string;
}

/** Sent → delivered → read, as the sender sees it. */
export type Receipt = "sending" | "failed" | "sent" | "delivered" | "read";

export function receiptOf(m: Pick<ChatMessage, "local" | "isRead" | "deliveredAt">): Receipt {
  if (m.local) return m.local;
  if (m.isRead) return "read";
  if (m.deliveredAt) return "delivered";
  return "sent";
}

export interface OnlinePerson extends Person {
  presence: PresenceView;
}
