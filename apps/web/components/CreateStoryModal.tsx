"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles, Film, Image as ImageIcon, Loader2, CheckCircle2, Lock, Users, Globe, UploadCloud } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateStoryModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateStoryModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [caption, setCaption] = useState("");
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [bunnyVideoId, setBunnyVideoId] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "CONTACTS_ONLY" | "SUBSCRIBERS_ONLY">("PUBLIC");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaType,
          mediaUrl: mediaUrl.trim() || undefined,
          bunnyVideoId: bunnyVideoId.trim() || undefined,
          caption: caption.trim(),
          visibility,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create story.");
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
        router.refresh();
        onSuccess?.();
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-950 dark:bg-zinc-950 light:bg-white shadow-2xl p-6 text-white dark:text-white light:text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 dark:border-white/10 light:border-black/5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">Publish 24h Fleet Story</h3>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-400 light:text-slate-500">
                Ephemeral media on Bunny edge • Expires in 24 hours
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-zinc-400 hover:text-white dark:hover:text-white light:hover:text-black transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="py-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 animate-in zoom-in">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="text-base font-bold">Story Published!</h4>
            <p className="text-xs text-zinc-400">Your live fleet is now streaming on the creator bar.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-2.5 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* Media Type Toggle */}
            <div className="flex rounded-xl bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-100 p-1 border border-white/5 dark:border-white/5 light:border-black/5">
              <button
                type="button"
                onClick={() => setMediaType("IMAGE")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  mediaType === "IMAGE"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Photo Story</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaType("VIDEO")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                  mediaType === "VIDEO"
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Film className="h-3.5 w-3.5" />
                <span>Bunny Video Clip</span>
              </button>
            </div>

            {/* Media Source Inputs */}
            {mediaType === "IMAGE" ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 mb-1">
                  Photo / Story Media URL
                </label>
                <input
                  type="url"
                  required
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="https://... or uploaded image path"
                  className="w-full rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-50 px-3 py-2 text-xs outline-none focus:border-violet-500 placeholder:text-zinc-600"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 mb-1">
                    Bunny Stream Video GUID
                  </label>
                  <input
                    type="text"
                    required
                    value={bunnyVideoId}
                    onChange={(e) => setBunnyVideoId(e.target.value)}
                    placeholder="e.g. 9b3c4a12-8819-4820-a6fe-b715a3e144bb"
                    className="w-full rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-50 px-3 py-2 text-xs outline-none focus:border-violet-500 placeholder:text-zinc-600 font-mono"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Enter any video GUID from your Bunny.net Stream library. HLS tokens will be automatically signed.
                  </p>
                </div>
              </div>
            )}

            {/* Ephemeral Caption */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 mb-1">
                Story Caption (Max 280 chars)
              </label>
              <textarea
                rows={3}
                maxLength={280}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's happening behind the scenes right now? Tease upcoming 4K releases…"
                className="w-full rounded-xl border border-white/10 dark:border-white/10 light:border-black/10 bg-zinc-900/60 dark:bg-zinc-900/60 light:bg-slate-50 p-3 text-xs outline-none focus:border-violet-500 placeholder:text-zinc-600 resize-none"
              />
              <div className="text-right text-[10px] text-zinc-500 font-mono">
                {caption.length}/280
              </div>
            </div>

            {/* Visibility Selector */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 dark:text-zinc-300 light:text-slate-700 mb-1.5">
                Audience Access
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "PUBLIC", label: "Public", icon: Globe },
                  { id: "CONTACTS_ONLY", label: "Contacts", icon: Users },
                  { id: "SUBSCRIBERS_ONLY", label: "VIP Only", icon: Lock },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVisibility(id as typeof visibility)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition-all ${
                      visibility === id
                        ? "border-violet-500 bg-violet-600/20 text-violet-300"
                        : "border-white/5 bg-zinc-900/40 text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-[11px] font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Publishing to Edge…</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="h-4 w-4" />
                    <span>Post 24h Story</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
