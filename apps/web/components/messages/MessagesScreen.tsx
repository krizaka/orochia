"use client";

import { MessageIcon, PlusIcon, SearchIcon } from "@krizaka/icons";
import { useRouter, useSearchParams } from "next/navigation";
import { usePathname } from "@/lib/use-pathname";
import React, { useCallback, useEffect, useState } from "react";

import { ConversationList } from "@/components/messages/ConversationList";
import { NewGroupDialog } from "@/components/messages/NewGroupDialog";
import { OnlineNow } from "@/components/messages/OnlineNow";
import { Thread } from "@/components/messages/Thread";
import { useChat } from "@/components/messages/useChat";
import { Button, cn, IconButton, Input, Spinner } from "@/components/ui";
import { responseErrorMessage } from "@/lib/api-errors";
import { useAuth } from "@/lib/auth-context";
import { conversationPath } from "@/lib/conversation-path";
import { useI18n } from "@/lib/i18n-client";
import { useLiveStatus } from "@/lib/realtime-client";

/**
 * Messages, Messenger-style: conversations with presence on the left, the open conversation on the right (one at a
 * time on a phone). The address is the state: `/messages/<conversation>` (the universal link a push opens); `/messages?user=<username>` opens (or
 * starts) the conversation with that account.
 */
export function MessagesScreen({ conversationId }: { conversationId: string | null }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const myId = user?.id ?? null;
  const activeId = conversationId;
  const targetUser = params.get("user");

  const chat = useChat(myId, activeId);
  const live = useLiveStatus();
  const [newChat, setNewChat] = useState(targetUser ?? "");
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const open = useCallback((id: string | null) => router.replace(conversationPath(id), { scroll: false }), [router]);

  const start = useCallback(
    async (username: string) => {
      const name = username.trim().replace(/^@/, "");
      if (!name) return;
      setStarting(true);
      setStartError(null);
      const res = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientUsername: name }) }).catch(() => null);
      setStarting(false);
      if (!res?.ok) return setStartError(res ? await responseErrorMessage(t, res, t("inbox.startFailed")) : t("inbox.network"));
      const data = (await res.json()) as { conversationId: string };
      setNewChat("");
      await chat.reload();
      open(data.conversationId);
    },
    [chat, open, t],
  );

  // `?user=` (a "Message" button elsewhere): open that conversation, then the address names it.
  useEffect(() => {
    if (targetUser && myId) void start(targetUser);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUser, myId]);

  const conversation = chat.conversations.find((c) => c.id === activeId) ?? null;

  // Signed out: sign in, then come back to the same address.
  useEffect(() => {
    if (!isLoading && !user) router.replace(`/auth/login?next=${encodeURIComponent(params.size ? `${pathname}?${params.toString()}` : pathname)}`);
  }, [isLoading, user, router, pathname, params]);

  return (
    <div className="mx-auto max-w-7xl px-0 py-0 sm:px-6 sm:py-6 lg:px-8">
      <div className="mb-4 hidden items-end justify-between gap-4 sm:flex">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-2xl font-bold text-fg">
            <MessageIcon size={24} className="text-fg-accent" />
            {t("inbox.title")}
          </h1>
          <p className="mt-1 text-xs text-fg-secondary">{t("inbox.intro")}</p>
        </div>
      </div>

      {live === "reconnecting" && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-fg">
          <Spinner size="sm" className="text-current" />
          {t("inbox.reconnecting")}
        </p>
      )}

      <div className="grid h-[calc(100dvh-8rem-env(safe-area-inset-bottom))] grid-cols-1 overflow-hidden border-border-default bg-surface-1/80 sm:h-[calc(100dvh-12rem)] sm:min-h-[520px] sm:rounded-3xl sm:border sm:shadow-2xl lg:grid-cols-12">
        <aside className={cn("flex min-h-0 flex-col border-border-default lg:col-span-4 lg:border-r", activeId ? "hidden lg:flex" : "flex")}>
          <div className="border-b border-border-default p-3 sm:p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void start(newChat);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-secondary" />
                <Input
                  type="text"
                  aria-label={t("inbox.start")}
                  placeholder={t("inbox.newPlaceholder")}
                  value={newChat}
                  onChange={(e) => setNewChat(e.target.value)}
                  autoCapitalize="none"
                  spellCheck={false}
                  className="h-10 rounded-xl bg-surface-2/60 pl-9 pr-3 text-sm"
                />
              </div>
              <IconButton type="submit" variant="primary" shape="rounded" disabled={!newChat.trim()} loading={starting} className="h-10 w-10 rounded-xl" label={t("inbox.start")}>
                <PlusIcon size={16} />
              </IconButton>
            </form>
            <NewGroupDialog
              onCreated={(id) => {
                void chat.reload();
                open(id);
              }}
            >
              <Button variant="ghost" size="sm" className="mt-2 w-full justify-start">
                <PlusIcon size={14} /> {t("inbox.group.new")}
              </Button>
            </NewGroupDialog>
            {startError && (
              <p role="alert" className="mt-2 text-xs text-fg-danger">
                {startError}
              </p>
            )}
          </div>
          <OnlineNow people={chat.online} onOpen={(username) => void start(username)} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList conversations={chat.conversations} loaded={chat.listLoaded} activeId={activeId} myId={myId} presence={chat.presence} typing={chat.typing} />
          </div>
        </aside>

        <section aria-label={t("inbox.thread")} className={cn("min-h-0 lg:col-span-8", activeId ? "flex flex-col" : "hidden lg:flex lg:flex-col")}>
          {myId && (
            <Thread
              conversation={conversation}
              myId={myId}
              presence={conversation ? chat.presence[conversation.otherUser.id] : undefined}
              messages={chat.messages}
              names={chat.names}
              state={chat.thread}
              typing={Boolean(conversation && chat.typing[conversation.id])}
              onBack={() => open(null)}
              onSend={chat.send}
              onRetry={chat.retry}
              onDiscard={chat.discard}
              onTyping={chat.onTyping}
              onLoadOlder={() => void chat.loadOlder()}
              onBlock={(block) => (conversation ? chat.setBlocked(conversation, block) : Promise.resolve(false))}
            />
          )}
        </section>
      </div>

      {/* New messages in other conversations, said once to screen readers (the open one is a live log). */}
      <p className="sr-only" aria-live="polite" role="status">
        {chat.announcement}
      </p>
    </div>
  );
}

