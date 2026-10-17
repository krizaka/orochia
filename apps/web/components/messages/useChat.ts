"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { responseErrorMessage } from "@/lib/api-errors";
import { useI18n } from "@/lib/i18n-client";
import { type LiveEvent, useLiveEvents } from "@/lib/realtime-client";

import { applyMessageToList, applyReceipt, applyReceiptToList, markListRead, mergeMessages } from "./chat-state";
import type { ChatMessage, Conversation, OnlinePerson, PresenceView, ServerMessage } from "./types";

const TYPING_SHOWN_MS = 6000;
const TYPING_SEND_EVERY_MS = 3000;
const TYPING_STOP_AFTER_MS = 4000;

const visible = () => typeof document !== "undefined" && document.visibilityState === "visible";

/**
 * Messages, live: the conversation list (with presence, unread counts and "typing…"), the open thread (optimistic
 * sending with retry, receipts, older pages), "Online now", and an announcement for screen readers. Everything moves
 * with the account's stream (lib/realtime-client.ts); a reconnection reloads what may have changed meanwhile.
 */
export function useChat(myId: string | null, activeId: string | null) {
  const { t } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [presence, setPresence] = useState<Record<string, PresenceView>>({});
  const [online, setOnline] = useState<OnlinePerson[]>([]);
  const [typing, setTyping] = useState<Record<string, number>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadState, setThreadState] = useState<{ loading: boolean; hasMore: boolean; error: string | null; loadingOlder: boolean }>({ loading: false, hasMore: false, error: null, loadingOlder: false });
  const [announcement, setAnnouncement] = useState("");
  /** Who wrote, in a group (display names of the senders loaded so far). */
  const [names, setNames] = useState<Record<string, string>>({});

  const active = useRef(activeId);
  active.current = activeId;
  const convs = useRef(conversations);
  convs.current = conversations;
  const msgs = useRef(messages);
  msgs.current = messages;

  // ── Loading ─────────────────────────────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    const res = await fetch("/api/conversations", { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { conversations: Conversation[] };
      setConversations(data.conversations);
      setPresence((all) => {
        const next = { ...all };
        for (const c of data.conversations) {
          if (c.presence) next[c.otherUser.id] = c.presence;
          else delete next[c.otherUser.id];
        }
        return next;
      });
    }
    setListLoaded(true);
  }, []);

  const loadOnline = useCallback(async () => {
    const res = await fetch("/api/presence/online", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setOnline(((await res.json()) as { online: OnlinePerson[] }).online);
  }, []);

  const loadThread = useCallback(async (conversationId: string, { quiet = false } = {}) => {
    if (!quiet) setThreadState((s) => ({ ...s, loading: true, error: null }));
    const res = await fetch(`/api/conversations/${conversationId}/messages`, { cache: "no-store" }).catch(() => null);
    if (active.current !== conversationId) return;
    if (!res?.ok) {
      setThreadState((s) => ({ ...s, loading: false, error: res ? t("inbox.loadFailed") : t("inbox.network") }));
      return;
    }
    const data = (await res.json()) as { messages: ServerMessage[]; hasMore: boolean; names?: Record<string, string> };
    if (data.names) setNames((all) => ({ ...all, ...data.names }));
    // Keep what is still on its way from this app; the page read the latest messages (marked read by the server).
    setMessages((current) => mergeMessages(quiet ? current : current.filter((m) => m.local && m.conversationId === conversationId), data.messages));
    setThreadState({ loading: false, hasMore: data.hasMore, error: null, loadingOlder: false });
    setConversations((list) => markListRead(list, conversationId));
  }, [t]);

  const loadOlder = useCallback(async () => {
    const conversationId = active.current;
    const first = msgs.current.find((m) => !m.local);
    if (!conversationId || !first) return;
    setThreadState((s) => ({ ...s, loadingOlder: true }));
    const res = await fetch(`/api/conversations/${conversationId}/messages?before=${first.seq}`, { cache: "no-store" }).catch(() => null);
    if (active.current !== conversationId) return;
    if (!res?.ok) return setThreadState((s) => ({ ...s, loadingOlder: false }));
    const data = (await res.json()) as { messages: ServerMessage[]; hasMore: boolean; names?: Record<string, string> };
    if (data.names) setNames((all) => ({ ...all, ...data.names }));
    setMessages((current) => mergeMessages(current, data.messages));
    setThreadState((s) => ({ ...s, hasMore: data.hasMore, loadingOlder: false }));
  }, []);

  useEffect(() => {
    if (!myId) return;
    void loadList();
    void loadOnline();
    // Presence of people outside the circle's live events (an instance that went away) settles on a slow poll.
    const poll = setInterval(() => {
      void loadList();
      void loadOnline();
    }, 120_000);
    return () => clearInterval(poll);
  }, [myId, loadList, loadOnline]);

  useEffect(() => {
    setMessages([]);
    if (!activeId || !myId) return setThreadState({ loading: false, hasMore: false, error: null, loadingOlder: false });
    void loadThread(activeId);
  }, [activeId, myId, loadThread]);

  // ── Reading ─────────────────────────────────────────────────────────────────────────────────
  const markRead = useCallback((conversationId: string, upTo?: number) => {
    setConversations((list) => markListRead(list, conversationId));
    void fetch(`/api/conversations/${conversationId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(upTo ? { upTo } : {}),
    }).catch(() => undefined);
  }, []);

  // Back on the tab with unread messages in the open conversation: they are read now.
  useEffect(() => {
    const onVisible = () => {
      const id = active.current;
      if (!visible() || !id) return;
      if (convs.current.find((c) => c.id === id)?.unreadCount) markRead(id);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [markRead]);

  // ── Typing (received) ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(typing).length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setTyping((all) => {
        const next = Object.fromEntries(Object.entries(all).filter(([, until]) => until > now));
        return Object.keys(next).length === Object.keys(all).length ? all : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [typing]);

  // ── Live events ─────────────────────────────────────────────────────────────────────────────
  const onEvent = (event: LiveEvent) => {
    if (!myId) return;
    switch (event.type) {
      case "connected":
        if (event.reconnect) {
          void loadList();
          void loadOnline();
          if (active.current) void loadThread(active.current, { quiet: true });
        }
        return;
      case "resync":
        void loadList();
        if (active.current) void loadThread(active.current, { quiet: true });
        return;
      case "new_message":
      case "message_sent": {
        const message = event.message as ServerMessage;
        const reading = message.conversationId === active.current && visible();
        if (message.conversationId === active.current) setMessages((current) => mergeMessages(current, [message]));
        setTyping((all) => {
          if (!(message.conversationId in all) || message.senderId === myId) return all;
          const next = { ...all };
          delete next[message.conversationId];
          return next;
        });
        const updated = applyMessageToList(convs.current, message, myId, reading);
        if (updated) setConversations(updated);
        else void loadList();
        if (event.type === "new_message") {
          if (reading) markRead(message.conversationId, message.seq);
          else {
            const from = convs.current.find((c) => c.id === message.conversationId)?.otherUser.displayName;
            if (from) setAnnouncement(t("inbox.newFrom", { name: from, text: message.content.slice(0, 140) }));
          }
        }
        return;
      }
      case "receipt": {
        const receipt = event as unknown as { conversationId: string; state: "delivered" | "read"; upTo: number; at: string };
        if (receipt.conversationId === active.current) setMessages((current) => applyReceipt(current, myId, receipt));
        setConversations((list) => applyReceiptToList(list, myId, receipt));
        return;
      }
      case "conversation_changed":
        // A group changed (name, members, mute): the list, and the open conversation's senders.
        void loadList();
        if (active.current === String(event.conversationId)) void loadThread(active.current, { quiet: true });
        return;
      case "read":
        setConversations((list) => markListRead(list, String(event.conversationId)));
        return;
      case "typing": {
        const conversationId = String(event.conversationId);
        if (event.userId === myId) return;
        setTyping((all) => {
          const next = { ...all };
          if (event.typing) next[conversationId] = Date.now() + TYPING_SHOWN_MS;
          else delete next[conversationId];
          return next;
        });
        return;
      }
      case "presence": {
        const userId = String(event.userId);
        const view = { state: event.state, lastSeenAt: event.lastSeenAt } as PresenceView;
        setPresence((all) => ({ ...all, [userId]: view }));
        setOnline((list) => {
          const known = list.find((p) => p.id === userId);
          if (view.state === "offline") return list.filter((p) => p.id !== userId);
          if (known) return list.map((p) => (p.id === userId ? { ...p, presence: view } : p));
          void loadOnline();
          return list;
        });
        return;
      }
      case "presence_snapshot":
        setPresence((all) => ({ ...all, ...(event.presence as Record<string, PresenceView>) }));
        return;
      case "circle_changed":
        void loadList();
        void loadOnline();
        return;
    }
  };
  useLiveEvents(Boolean(myId), onEvent);

  // ── Sending ─────────────────────────────────────────────────────────────────────────────────
  const post = useCallback(async (message: ChatMessage) => {
    const res = await fetch(`/api/conversations/${message.conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message.content, clientId: message.clientId }),
    }).catch(() => null);
    if (res?.ok) {
      const stored = ((await res.json()) as { message: ServerMessage }).message;
      setMessages((current) => mergeMessages(current, [stored]));
      const updated = applyMessageToList(convs.current, stored, message.senderId, true);
      if (updated) setConversations(updated);
      return;
    }
    const error = res ? await responseErrorMessage(t, res, t("inbox.sendFailed")) : t("inbox.network");
    setMessages((current) => current.map((m) => (m.clientId === message.clientId && m.local ? { ...m, local: "failed", error } : m)));
  }, [t]);

  const send = useCallback(
    (content: string) => {
      const conversationId = active.current;
      const text = content.trim();
      if (!conversationId || !myId || !text) return;
      const conversation = convs.current.find((c) => c.id === conversationId);
      const clientId = crypto.randomUUID();
      const local: ChatMessage = {
        id: `local-${clientId}`,
        seq: 0,
        clientId,
        conversationId,
        senderId: myId,
        recipientId: conversation?.otherUser.id ?? "",
        content: text,
        storyId: null,
        origin: "human",
        deliveredAt: null,
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
        local: "sending",
      };
      setMessages((current) => mergeMessages(current, [local]));
      stopTyping();
      void post(local);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myId, post],
  );

  /** Sends a failed message again — with the same clientId: if the first try did arrive, nothing is doubled. */
  const retry = useCallback(
    (clientId: string) => {
      const message = msgs.current.find((m) => m.clientId === clientId && m.local === "failed");
      if (!message) return;
      const again = { ...message, local: "sending" as const, error: undefined };
      setMessages((current) => current.map((m) => (m.clientId === clientId ? again : m)));
      void post(again);
    },
    [post],
  );

  const discard = useCallback((clientId: string) => {
    setMessages((current) => current.filter((m) => !(m.clientId === clientId && m.local === "failed")));
  }, []);

  // ── Typing (sent) ───────────────────────────────────────────────────────────────────────────
  const typingSent = useRef<{ at: number; conversationId: string | null }>({ at: 0, conversationId: null });
  const typingStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signal = (conversationId: string, value: boolean) =>
    void fetch(`/api/conversations/${conversationId}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typing: value }) }).catch(() => undefined);

  function stopTyping() {
    if (typingStop.current) clearTimeout(typingStop.current);
    typingStop.current = null;
    const { conversationId } = typingSent.current;
    if (conversationId) signal(conversationId, false);
    typingSent.current = { at: 0, conversationId: null };
  }

  /** Called on each keystroke: at most one signal every 3 s, and "stopped" after 4 s without typing. */
  const onTyping = useCallback(() => {
    const conversationId = active.current;
    if (!conversationId) return;
    const now = Date.now();
    if (typingSent.current.conversationId !== conversationId || now - typingSent.current.at > TYPING_SEND_EVERY_MS) {
      typingSent.current = { at: now, conversationId };
      signal(conversationId, true);
    }
    if (typingStop.current) clearTimeout(typingStop.current);
    typingStop.current = setTimeout(stopTyping, TYPING_STOP_AFTER_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopTyping(), [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Blocking ────────────────────────────────────────────────────────────────────────────────
  const setBlocked = useCallback(
    async (conversation: Conversation, block: boolean) => {
      const res = await fetch(`/api/users/${conversation.otherUser.username}/block`, { method: block ? "POST" : "DELETE" }).catch(() => null);
      if (!res?.ok) return false;
      if (block && !(await res.json().catch(() => ({ blocked: true }))).blocked) {
        // The toggle found an existing block and lifted it: put it back.
        await fetch(`/api/users/${conversation.otherUser.username}/block`, { method: "POST" }).catch(() => null);
      }
      await loadList();
      return true;
    },
    [loadList],
  );

  return {
    conversations,
    listLoaded,
    presence,
    online,
    typing,
    messages: activeId ? messages.filter((m) => m.conversationId === activeId) : [],
    thread: threadState,
    announcement,
    names,
    send,
    retry,
    discard,
    onTyping,
    loadOlder,
    reload: loadList,
    setBlocked,
  };
}
