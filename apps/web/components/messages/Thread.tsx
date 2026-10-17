"use client";

import { BackIcon, FlagIcon, ForwardIcon, MessageIcon, MoreIcon, UserIcon, WarningIcon } from "@krizaka/icons";
import Link from "next/link";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AlertDialog, Button, cn, DropdownMenu, EmptyState, IconButton, Skeleton, Textarea, toast } from "@/components/ui";
import { t } from "@/lib/i18n";
import { isAiAssisted } from "@/lib/message-origin";

import { dayKey } from "./chat-state";
import { Ticks } from "./ConversationList";
import { PresenceAvatar, presenceLabel } from "./PresenceAvatar";
import { ReportMessageDialog } from "./ReportMessageDialog";
import { type ChatMessage, type Conversation, type PresenceView, receiptOf } from "./types";

const MAX_LENGTH = 4000;

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (dayKey(iso) === dayKey(today.toISOString())) return t("inbox.today");
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return t("inbox.yesterday");
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Three dots that breathe (still under reduced motion), and the words for screen readers. */
function TypingBubble({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2" role="status">
      <span className="sr-only">{t("inbox.typingLabel", { name })}</span>
      <span aria-hidden className="inline-flex items-center gap-1 rounded-2xl rounded-bl-sm border border-border-default bg-surface-2 px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 rounded-full bg-fg-muted motion-safe:animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
    </div>
  );
}

export interface ThreadProps {
  conversation: Conversation | null;
  myId: string;
  presence?: PresenceView;
  messages: ChatMessage[];
  state: { loading: boolean; hasMore: boolean; error: string | null; loadingOlder: boolean };
  typing: boolean;
  onBack: () => void;
  onSend: (content: string) => void;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
  onTyping: () => void;
  onLoadOlder: () => void;
  onBlock: (block: boolean) => Promise<boolean>;
}

/**
 * One conversation: who it is with and whether they are there, the messages (a `log`: assistive technology reads what
 * arrives), receipts on the sender's last message, "typing…", and the composer — Enter sends, Shift + Enter breaks the
 * line; a message that could not leave stays in place with Retry.
 */
export function Thread({ conversation, myId, presence, messages, state, typing, onBack, onSend, onRetry, onDiscard, onTyping, onLoadOlder, onBlock }: ThreadProps) {
  const [draft, setDraft] = useState("");
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const previousFirst = useRef<string | null>(null);
  const previousHeight = useRef(0);

  // A new conversation: empty composer, focus on it (keyboard users write at once).
  useEffect(() => {
    setDraft("");
    stick.current = true;
    if (conversation && window.matchMedia("(min-width: 1024px)").matches) composer.current?.focus();
  }, [conversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stay at the bottom when it is where the reader is; keep the place when older messages are added above.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const first = messages[0]?.id ?? null;
    if (previousFirst.current && first !== previousFirst.current && previousHeight.current) {
      el.scrollTop += el.scrollHeight - previousHeight.current;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
    previousFirst.current = first;
    previousHeight.current = el.scrollHeight;
  }, [messages, typing]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState icon={<MessageIcon size={32} />} title={t("inbox.emptyTitle")} description={t("inbox.emptyHint")} />
      </div>
    );
  }

  const other = conversation.otherUser;
  const status = presenceLabel(presence);
  const lastMine = [...messages].reverse().find((m) => m.senderId === myId && !m.local);

  const submit = () => {
    const text = draft.trim();
    if (!text || conversation.blockedByMe) return;
    onSend(text);
    setDraft("");
    stick.current = true;
  };

  const block = async () => {
    const ok = await onBlock(true);
    if (ok) toast(t("inbox.blocked", { username: other.username }));
  };
  const unblock = async () => {
    const ok = await onBlock(false);
    if (ok) toast(t("inbox.unblocked", { username: other.username }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border-default p-3 sm:p-4">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton onClick={onBack} shape="rounded" className="h-9 w-9 lg:hidden" label={t("inbox.back")}>
            <BackIcon size={18} />
          </IconButton>
          <PresenceAvatar src={other.avatarUrl} name={other.displayName} presence={presence} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-fg">{other.displayName}</h2>
            <p className="truncate text-[11px] text-fg-secondary" aria-live="polite">
              {typing ? <span className="text-fg-accent">{t("inbox.typing")}</span> : (status ?? `@${other.username}`)}
            </p>
          </div>
        </div>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <IconButton shape="rounded" className="h-9 w-9" label={t("inbox.options")}>
              <MoreIcon size={16} />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item asChild>
              <Link href={`/@${other.username}`}>
                <UserIcon size={15} />
                {t("inbox.viewProfile")}
              </Link>
            </DropdownMenu.Item>
            {conversation.blockedByMe ? (
              <DropdownMenu.Item onSelect={() => void unblock()}>{t("inbox.unblock")}</DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item tone="danger" onSelect={() => setTimeout(() => setConfirmBlock(true), 0)}>
                {t("inbox.block")}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-5"
      >
        {state.loading && messages.length === 0 ? (
          <div className="space-y-3" aria-busy>
            {[40, 65, 30, 55].map((w, i) => (
              <Skeleton key={i} className={cn("h-9 rounded-2xl", i % 2 ? "ml-auto" : "")} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : state.error ? (
          <p role="alert" className="mx-auto mt-6 flex max-w-sm items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-fg-danger">
            <WarningIcon size={16} /> {state.error}
          </p>
        ) : messages.length === 0 ? (
          <EmptyState className="mt-10" icon={<MessageIcon size={28} />} title={t("inbox.startTitle")} description={t("inbox.sayHello", { username: other.username })} />
        ) : (
          <>
            {state.hasMore && (
              <div className="mb-4 flex justify-center">
                <Button variant="ghost" size="sm" onClick={onLoadOlder} loading={state.loadingOlder}>
                  {t("inbox.loadOlder")}
                </Button>
              </div>
            )}
            <ol role="log" aria-label={t("inbox.log", { name: other.displayName })} className="space-y-1.5">
              {messages.map((m, i) => {
                const mine = m.senderId === myId;
                const separator = i === 0 || dayKey(messages[i - 1].createdAt) !== dayKey(m.createdAt) ? dayLabel(m.createdAt) : null;
                const receipt = receiptOf(m);
                return (
                  <li key={m.clientId ?? m.id}>
                    {separator && (
                      <p className="my-4 text-center text-[10px] font-semibold uppercase tracking-wider text-fg-muted">{separator}</p>
                    )}
                    <div className={cn("group flex items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
                      {!mine && !m.local && (
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <IconButton
                              shape="rounded"
                              label={t("inbox.messageActions")}
                              className="order-2 h-7 w-7 opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 data-[state=open]:opacity-100"
                            >
                              <MoreIcon size={14} />
                            </IconButton>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Content align="start">
                            <DropdownMenu.Item tone="danger" onSelect={() => setTimeout(() => setReporting(m), 0)}>
                              <FlagIcon size={15} />
                              {t("inbox.reportMessage")}
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
                      )}
                      <div
                        className={cn(
                          "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                          mine ? "rounded-br-sm bg-linear-to-tr from-accent to-accent-2 text-on-accent" : "rounded-bl-sm border border-border-default bg-surface-2 text-fg",
                          m.local === "sending" && "opacity-70",
                          m.local === "failed" && "ring-2 ring-danger/60",
                        )}
                      >
                        {m.storyId && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-75">{t("inbox.storyReply")}</p>}
                        {isAiAssisted(m.origin) && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider opacity-75">{t("inbox.aiAssisted")}</p>}
                        <p className="whitespace-pre-wrap wrap-break-word">{m.content}</p>
                        <p className={cn("mt-0.5 text-right text-[10px]", mine ? "text-on-accent/80" : "text-fg-muted")}>
                          <time dateTime={m.createdAt}>{time(m.createdAt)}</time>
                        </p>
                      </div>
                    </div>
                    {mine && m.local === "failed" && (
                      <p role="alert" className="mt-1 flex items-center justify-end gap-2 text-[11px] text-fg-danger">
                        <span>{m.error ?? t("inbox.status.failed")}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onRetry(m.clientId!)}>
                          {t("inbox.retry")}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-fg-secondary" onClick={() => onDiscard(m.clientId!)}>
                          {t("inbox.discard")}
                        </Button>
                      </p>
                    )}
                    {mine && (m.local === "sending" || m.id === lastMine?.id) && (
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-fg-muted">
                        {receipt !== "sending" && receipt !== "failed" && <Ticks receipt={receipt} />}
                        <span>{t(`inbox.status.${receipt}`)}</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
        {typing && (
          <div className="mt-2">
            <TypingBubble name={other.displayName} />
          </div>
        )}
      </div>

      <div className="border-t border-border-default p-3 sm:p-4">
        {conversation.blockedByMe ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-2/60 p-3 text-xs text-fg-secondary">
            <span>{t("inbox.blockedBanner", { username: other.username })}</span>
            <Button variant="outline" size="sm" onClick={() => void unblock()}>
              {t("inbox.unblock")}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-end gap-2"
          >
            <label htmlFor="composer" className="sr-only">
              {t("inbox.composerLabel", { name: other.displayName })}
            </label>
            <Textarea
              id="composer"
              ref={composer}
              rows={1}
              value={draft}
              maxLength={MAX_LENGTH}
              placeholder={t("inbox.messagePlaceholder")}
              aria-describedby="composer-hint"
              onChange={(e) => {
                setDraft(e.target.value);
                if (e.target.value.trim()) onTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="max-h-40 min-h-11 flex-1 resize-none rounded-xl px-4 py-2.5 text-sm field-sizing-content"
            />
            <IconButton type="submit" variant="primary" shape="rounded" disabled={!draft.trim()} label={t("inbox.send")} className="h-11 w-11 shrink-0 rounded-xl">
              <ForwardIcon size={16} />
            </IconButton>
            <span id="composer-hint" className="sr-only">
              {t("inbox.sendHint")}
            </span>
          </form>
        )}
      </div>

      <ReportMessageDialog conversationId={conversation.id} message={reporting} onClose={() => setReporting(null)} />
      <AlertDialog
        open={confirmBlock}
        onOpenChange={setConfirmBlock}
        title={t("inbox.blockTitle", { username: other.username })}
        description={t("inbox.blockBody")}
        confirmLabel={t("inbox.blockConfirm")}
        tone="danger"
        onConfirm={() => void block()}
      />
    </div>
  );
}
