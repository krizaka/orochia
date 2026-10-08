"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Send,
  User,
  ShieldAlert,
  Search,
  MoreVertical,
  Check,
  CheckCheck,
  UserX,
  Plus,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n";

interface OtherUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface ConversationItem {
  id: string;
  otherUser: OtherUser;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
  } | null;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const initialTargetUser = searchParams?.get("user");

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputContent, setInputContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // New conversation modal / state
  const [newChatUsername, setNewChatUsername] = useState(initialTargetUser || "");
  const [startingChat, setStartingChat] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load current user profile
  useEffect(() => {
    fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user?.id) {
          setCurrentUserId(data.user.id);
        }
      })
      .catch(() => undefined);
  }, []);

  // Fetch conversations list
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true);
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        if (data.currentUserId) {
          setCurrentUserId(data.currentUserId);
        }
      }
    } catch (e) {
      console.error("Failed to load conversations", e);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // If a target user was passed in query parameter (e.g. ?user=miasterling)
  useEffect(() => {
    if (initialTargetUser && conversations.length > 0) {
      const match = conversations.find((c) => c.otherUser.username.toLowerCase() === initialTargetUser.toLowerCase());
      if (match) {
        setActiveConversation(match);
      }
    }
  }, [initialTargetUser, conversations]);

  // Load messages for the active conversation
  const loadMessages = useCallback(async (convId: string) => {
    try {
      setLoadingMessages(true);
      setError(null);
      const res = await fetch(`/api/conversations/${convId}/messages`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        const err = await res.json();
        setError(err.error || t("inbox.loadFailed"));
      }
    } catch (e) {
      setError(t("inbox.network"));
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (activeConversation) {
      void loadMessages(activeConversation.id);
    } else {
      setMessages([]);
    }
  }, [activeConversation, loadMessages]);

  // Connect to SSE stream for real-time messages
  useEffect(() => {
    const eventSource = new EventSource("/api/conversations/stream");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "new_message") {
          const newMsg = payload.message as Message;

          // If the message belongs to active thread, append it
          if (activeConversation && newMsg.conversationId === activeConversation.id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }

          // Update conversation list preview
          setConversations((prev) =>
            prev.map((conv) => {
              if (conv.id === newMsg.conversationId) {
                return {
                  ...conv,
                  lastMessage: {
                    id: newMsg.id,
                    content: newMsg.content,
                    senderId: newMsg.senderId,
                    createdAt: newMsg.createdAt,
                    isRead: newMsg.senderId === currentUserId,
                  },
                  updatedAt: newMsg.createdAt,
                };
              }
              return conv;
            })
          );
        }
      } catch (err) {
        console.error("Failed to parse SSE event", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeConversation, currentUserId]);

  // Start new conversation by username
  const handleStartConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatUsername.trim()) return;

    setStartingChat(true);
    setError(null);

    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientUsername: newChatUsername.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("inbox.startFailed"));
        return;
      }

      await loadConversations();
      setActiveConversation({
        id: data.conversationId,
        otherUser: data.otherUser,
        lastMessage: null,
        updatedAt: new Date().toISOString(),
      });
      setNewChatUsername("");
    } catch (e: any) {
      setError(e.message || t("inbox.startFailed"));
    } finally {
      setStartingChat(false);
    }
  };

  // Send a message in active conversation
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !inputContent.trim() || sending) return;

    setSending(true);
    setError(null);
    const content = inputContent.trim();
    setInputContent("");

    try {
      const res = await fetch(`/api/conversations/${activeConversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("inbox.sendFailed"));
        setInputContent(content); // restore input
        return;
      }

      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch (e: any) {
      setError(e.message || t("inbox.network"));
      setInputContent(content);
    } finally {
      setSending(false);
    }
  };

  // Block active user
  const handleBlockUser = async () => {
    if (!activeConversation) return;
    setBlocking(true);

    try {
      const res = await fetch(`/api/users/${activeConversation.otherUser.username}/block`, {
        method: "POST",
      });

      if (res.ok) {
        setShowOptionsModal(false);
        setActiveConversation(null);
        await loadConversations();
      }
    } catch (e) {
      console.error("Failed to block user", e);
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display flex items-center gap-2.5 light:text-slate-900">
            <MessageSquare className="h-6 w-6 text-violet-400" />
            <span>{t("inbox.title")}</span>
          </h1>
          <p className="text-xs text-zinc-400 light:text-slate-500 mt-1">
            {t("inbox.intro")}
          </p>
        </div>
      </div>

      {/* Main Messaging Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[720px] rounded-3xl border border-white/10 bg-zinc-950/80 backdrop-blur-xl shadow-2xl overflow-hidden light:bg-white light:border-black/10">
        {/* Left Column: Conversations Sidebar */}
        <aside
          className={`lg:col-span-4 border-r border-white/10 flex flex-col h-full light:border-black/10 ${
            activeConversation ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Search / Start New Chat */}
          <div className="p-4 border-b border-white/10 light:border-black/10">
            <form onSubmit={handleStartConversation} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 light:text-slate-500" />
                <input
                  type="text"
                  placeholder={t("inbox.newPlaceholder")}
                  value={newChatUsername}
                  onChange={(e) => setNewChatUsername(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-900/60 pl-9 pr-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
                />
              </div>
              <button
                type="submit"
                disabled={startingChat || !newChatUsername.trim()}
                className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-40 transition-colors flex items-center gap-1"
                title={t("inbox.start")}
                aria-label={t("inbox.start")}
              >
                {startingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </form>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 light:divide-black/5">
            {loadingConversations ? (
              <div className="flex flex-col items-center justify-center p-8 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <span className="text-xs">{t("inbox.loadingConversations")}</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
                <p className="text-xs font-semibold text-zinc-400 light:text-slate-600">{t("inbox.none")}</p>
                <p className="text-[11px] mt-1 text-zinc-500">
                  {t("inbox.noneHint")}
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConversation?.id === conv.id;
                const other = conv.otherUser;
                const hasUnread = conv.lastMessage && !conv.lastMessage.isRead && conv.lastMessage.senderId !== currentUserId;

                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversation(conv)}
                    className={`w-full text-left p-4 flex items-center gap-3 transition-colors ${
                      isSelected
                        ? "bg-violet-600/15 border-l-2 border-violet-500"
                        : "hover:bg-zinc-900/50 light:hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      {other.avatarUrl ? (
                        <img
                          src={other.avatarUrl}
                          alt={other.displayName || other.username}
                          className="h-11 w-11 rounded-full object-cover border border-white/10"
                        />
                      ) : (
                        <div className="h-11 w-11 rounded-full bg-zinc-800 flex items-center justify-center text-white">
                          <User className="h-5 w-5 text-zinc-400" />
                        </div>
                      )}
                      {hasUnread && (
                        <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-violet-500 border-2 border-zinc-950" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-white truncate light:text-slate-900">
                          {other.displayName || other.username}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-zinc-500 shrink-0">
                            {new Date(conv.lastMessage.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-[11px] truncate ${
                          hasUnread
                            ? "text-white font-semibold light:text-slate-900"
                            : "text-zinc-400 light:text-slate-500"
                        }`}
                      >
                        {conv.lastMessage?.content || t("inbox.noMessages")}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Chat Thread */}
        <section
          aria-label={t("inbox.thread")}
          className={`lg:col-span-8 flex flex-col h-full ${
            !activeConversation ? "hidden lg:flex" : "flex"
          }`}
        >
          {activeConversation ? (
            <>
              {/* Active Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between light:border-black/10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveConversation(null)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white lg:hidden"
                    title={t("inbox.back")}
                    aria-label={t("inbox.back")}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <div className="flex items-center gap-3">
                    {activeConversation.otherUser.avatarUrl ? (
                      <img
                        src={activeConversation.otherUser.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover border border-white/10"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-white">
                        <User className="h-5 w-5 text-zinc-400" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-white light:text-slate-900">
                        {activeConversation.otherUser.displayName || activeConversation.otherUser.username}
                      </h3>
                      <Link
                        href={`/users/${activeConversation.otherUser.username}`}
                        className="text-[11px] text-violet-400 hover:underline flex items-center gap-1"
                        target="_blank"
                      >
                        @{activeConversation.otherUser.username}
                        <ExternalLink className="h-3 w-3 inline" />
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setShowOptionsModal(!showOptionsModal)}
                    className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors light:hover:text-slate-900"
                    title={t("inbox.options")}
                    aria-label={t("inbox.options")}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>

                  {showOptionsModal && (
                    <div className="absolute right-0 top-10 w-44 rounded-xl border border-white/10 bg-zinc-900 p-1.5 shadow-2xl z-20 light:bg-white light:border-black/10">
                      <button
                        onClick={handleBlockUser}
                        disabled={blocking}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        <span>{t("inbox.block")}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div className="m-4 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-300 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Messages Bubble Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full text-zinc-500">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-xs font-semibold">{t("inbox.startTitle")}</p>
                    <p className="text-[11px] mt-1 max-w-xs">
                      {t("inbox.sayHello", { username: activeConversation.otherUser.username })}
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === currentUserId;

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[75%] px-4 py-2.5 text-xs rounded-2xl ${
                            isMine
                              ? "bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white rounded-br-sm shadow-md"
                              : "bg-zinc-900 border border-white/10 text-zinc-100 rounded-bl-sm light:bg-slate-100 light:border-black/10 light:text-slate-900"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-zinc-500">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isMine && (
                            <span>
                              {msg.isRead ? (
                                <CheckCheck className="h-3 w-3 text-violet-400" />
                              ) : (
                                <Check className="h-3 w-3 text-zinc-500" />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer */}
              <div className="p-4 border-t border-white/10 light:border-black/10">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                    placeholder={t("inbox.messagePlaceholder")}
                    maxLength={2000}
                    className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:text-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={!inputContent.trim() || sending}
                    className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-md shadow-violet-600/20"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{t("inbox.send")}</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 text-zinc-500">
              <div className="h-16 w-16 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-white light:text-slate-900">{t("inbox.emptyTitle")}</h3>
              <p className="text-xs text-zinc-400 max-w-sm mt-1 light:text-slate-500">
                {t("inbox.emptyHint")}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-24 text-center text-xs text-zinc-500 font-mono light:text-slate-500">
          {t("inbox.loading")}
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
