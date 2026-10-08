"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, Reply, Trash2 } from "lucide-react";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";

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
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={COMMENT_MAX_LENGTH}
        rows={2}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 resize-y rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none light:bg-slate-50 light:border-black/10 light:placeholder:text-slate-400 light:text-slate-900"
      />
      <button disabled={busy || !body.trim()} className="self-end rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
        {busy ? "Posting…" : "Post"}
      </button>
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
      setError(res.status === 429 ? "Slow down a little before commenting again." : "Your comment could not be posted.");
      return false;
    }
    setReplyTo(null);
    onCountChange(1);
    await load();
    return true;
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this comment?")) return;
    const res = await fetch(`/api/videos/${videoId}/comments/${id}`, { method: "DELETE" });
    if (!res.ok) return setError("The comment could not be removed.");
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
    else setError("The setting could not be saved.");
  };

  const threads = (comments ?? []).filter((c) => !c.parentId);
  const replies = (id: string) => (comments ?? []).filter((c) => c.parentId === id);

  const item = (c: Comment, isReply = false) => (
    <div key={c.id} className={`flex gap-3 ${isReply ? "mt-3" : ""}`}>
      <img src={c.authorAvatar || AVATAR_PLACEHOLDER} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <Link href={`/@${c.authorUsername}`} className="font-semibold text-white hover:text-violet-300 light:text-slate-900">
            {c.authorName}
          </Link>{" "}
          <span className="font-mono text-[10px] text-zinc-500 light:text-slate-500">
            {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </p>
        <p className={`mt-1 whitespace-pre-line break-words text-sm ${c.removed ? "italic text-zinc-500 light:text-slate-500" : "text-zinc-300 light:text-slate-700"}`}>
          {c.removed ? "Comment removed." : c.body}
        </p>
        <div className="mt-1 flex gap-3 text-[11px] text-zinc-500 light:text-slate-500">
          {user && enabled && !isReply && !c.removed && (
            <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="inline-flex items-center gap-1 hover:text-violet-300">
              <Reply className="h-3 w-3" /> Reply
            </button>
          )}
          {c.canRemove && (
            <button onClick={() => remove(c.id)} className="inline-flex items-center gap-1 hover:text-rose-300">
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
        {!isReply && replies(c.id).map((r) => item(r, true))}
        {replyTo === c.id && (
          <div className="mt-3">
            <Composer onSubmit={(body) => post(body, c.id)} placeholder={`Reply to ${c.authorName}`} autoFocus />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="mt-8" aria-labelledby="comments-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="comments-title" className="flex items-center gap-2 text-sm font-bold text-white light:text-slate-900">
          <MessageSquare className="h-4 w-4 text-violet-400" /> Comments
        </h2>
        {isCreator && (
          <button onClick={toggle} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/5 light:border-black/10 light:text-slate-700">
            {enabled ? "Close comments" : "Open comments"}
          </button>
        )}
      </div>

      {enabled ? (
        user ? (
          <Composer onSubmit={(body) => post(body, null)} placeholder="Add a comment" />
        ) : (
          <p className="text-xs text-zinc-400 light:text-slate-500">
            <Link href="/auth/login" className="text-violet-300 hover:underline">
              Sign in
            </Link>{" "}
            to comment.
          </p>
        )
      ) : (
        <p className="text-xs text-zinc-500 light:text-slate-500">Comments are closed on this video.</p>
      )}
      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      <div className="mt-6 space-y-5">
        {comments === null ? (
          <p className="text-xs text-zinc-500 light:text-slate-500">Loading…</p>
        ) : threads.length === 0 ? (
          <p className="text-xs text-zinc-500 light:text-slate-500">No comment yet.</p>
        ) : (
          threads.map((c) => item(c))
        )}
      </div>
    </section>
  );
}
