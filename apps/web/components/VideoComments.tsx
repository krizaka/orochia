"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Reply, Trash2 } from "lucide-react";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { Rich } from "@/components/Rich";
import { t } from "@/lib/i18n";
import { Avatar, Button, cn, Textarea } from "@/components/ui";

interface Comment {
  id: string;
  parentId: string | null;
  body: string | null;
  authorUsername: string;
  authorName: string;
  authorAvatar: string | null;
  createdAt: string;
  removed: boolean;
  canRemove: boolean;
}

const COMMENT_MAX_LENGTH = 2000;

function Composer({ onSubmit, placeholder, autoFocus }: { onSubmit: (body: string) => Promise<boolean>; placeholder: string; autoFocus?: boolean }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        if (await onSubmit(body.trim())) setBody("");
        setBusy(false);
      }}
      className="flex gap-2"
    >
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={COMMENT_MAX_LENGTH}
        rows={2}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 resize-y rounded-xl px-3 py-2"
      />
      <Button type="submit" variant="primary" size="sm" shape="rounded" disabled={busy || !body.trim()} className="self-end rounded-xl px-4 font-bold">
        {busy ? t("comments.posting") : t("comments.post")}
      </Button>
    </form>
  );
}

/**
 * The discussion under a video, shown to viewers who may watch it. Replies are one level deep; the
 * creator can close comments (existing ones stay readable) and remove any of them.
 */
export function VideoComments({
  videoId,
  isCreator,
  commentsEnabled: initiallyEnabled,
  onCountChange,
}: {
  videoId: string;
  isCreator: boolean;
  commentsEnabled: boolean;
  onCountChange: (delta: number) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/videos/${videoId}/comments`, { cache: "no-store" });
    setComments(res.ok ? ((await res.json()) as { comments: Comment[] }).comments : []);
  }, [videoId]);
  useEffect(() => void load(), [load]);

  const post = async (body: string, parentId: string | null) => {
    setError(null);
    const res = await fetch(`/api/videos/${videoId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, parentId }),
    });
    if (!res.ok) {
      setError(res.status === 429 ? t("comments.slowDown") : t("comments.postFailed"));
      return false;
    }
    setReplyTo(null);
    onCountChange(1);
    await load();
    return true;
  };

  // Two taps to remove (no browser dialog): the first arms the button, the second removes.
  const [confirming, setConfirming] = useState<string | null>(null);
  const remove = async (id: string) => {
    if (confirming !== id) return setConfirming(id);
    setConfirming(null);
    const res = await fetch(`/api/videos/${videoId}/comments/${id}`, { method: "DELETE" });
    if (!res.ok) return setError(t("comments.removeFailed"));
    onCountChange(-1);
    await load();
  };

  const toggle = async () => {
    const res = await fetch(`/api/videos/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentsEnabled: !enabled }),
    });
    if (res.ok) setEnabled(!enabled);
    else setError(t("comments.settingFailed"));
  };

  const threads = (comments ?? []).filter((c) => !c.parentId);
  const replies = (id: string) => (comments ?? []).filter((c) => c.parentId === id);

  const item = (c: Comment, isReply = false) => (
    <div key={c.id} className={cn("flex gap-3", isReply ? "mt-3" : "")}>
      <Avatar size="sm" src={c.authorAvatar || AVATAR_PLACEHOLDER} fallback={c.authorName.charAt(0)} />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <Link href={`/@${c.authorUsername}`} className="font-semibold text-fg hover:text-accent">
            {c.authorName}
          </Link>{" "}
          <span className="font-mono text-[10px] text-fg-muted">
            {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </p>
        <p className={cn(
          "mt-1 whitespace-pre-line wrap-break-word text-sm",
          c.removed ? "italic text-fg-muted" : "text-fg-secondary"
        )}>
          {c.removed ? t("comments.removed") : c.body}
        </p>
        <div className="mt-1 flex gap-3 text-[11px] text-fg-muted">
          {user && enabled && !isReply && !c.removed && (
            <Button variant="ghost" size="sm" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="h-auto gap-1 px-0 text-[inherit] font-normal hover:bg-transparent hover:text-accent">
              <Reply className="h-3 w-3" aria-hidden /> {t("comments.reply")}
            </Button>
          )}
          {c.canRemove && (
            <Button variant="ghost" size="sm" onClick={() => remove(c.id)} onBlur={() => setConfirming(null)} className={cn(
              "h-auto gap-1 px-0 text-[inherit] font-normal hover:bg-transparent hover:text-danger",
              confirming === c.id && "font-semibold text-danger"
            )}>
              <Trash2 className="h-3 w-3" aria-hidden /> {confirming === c.id ? t("comments.removeConfirm") : t("comments.remove")}
            </Button>
          )}
        </div>
        {!isReply && replies(c.id).map((r) => item(r, true))}
        {replyTo === c.id && (
          <div className="mt-3">
            <Composer onSubmit={(body) => post(body, c.id)} placeholder={t("comments.replyTo", { name: c.authorName })} autoFocus />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="mt-8" aria-labelledby="comments-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="comments-title" className="flex items-center gap-2 text-sm font-bold text-fg">
          <MessageSquare className="h-4 w-4 text-accent" /> {t("comments.title")}
        </h2>
        {isCreator && (
          <Button variant="outline" size="sm" shape="rounded" onClick={toggle} className="h-7 px-3 text-[11px] text-fg-secondary">
            {enabled ? t("comments.close") : t("comments.open")}
          </Button>
        )}
      </div>

      {enabled ? (
        user ? (
          <Composer onSubmit={(body) => post(body, null)} placeholder={t("comments.add")} />
        ) : (
          <p className="text-xs text-fg-secondary">
            <Rich
              text={t("comments.signInToComment")}
              slots={{
                signIn: (
                  <Link href={`/auth/login?next=/watch/${videoId}`} className="text-accent hover:underline">
                    {t("comments.signIn")}
                  </Link>
                ),
              }}
            />
          </p>
        )
      ) : (
        <p className="text-xs text-fg-muted">{t("comments.closed")}</p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <div className="mt-6 space-y-5">
        {comments === null ? (
          <p className="text-xs text-fg-muted">{t("comments.loading")}</p>
        ) : threads.length === 0 ? (
          <p className="text-xs text-fg-muted">{t("comments.empty")}</p>
        ) : (
          threads.map((c) => item(c))
        )}
      </div>
    </section>
  );
}
