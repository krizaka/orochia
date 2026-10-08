"use client";

import React, { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { CheckCircle2, Image as ImageIcon, Loader2, Scissors, Sparkles, UploadCloud, X } from "lucide-react";
import { VideoEditor } from "@/components/VideoEditor";
import { t } from "@/lib/i18n";

type Audience = "PUBLIC" | "APPROVED_FOLLOWERS_ONLY" | "CONTACTS_ONLY" | "INVITED_ONLY";
const AUDIENCES: Audience[] = ["PUBLIC", "APPROVED_FOLLOWERS_ONLY", "CONTACTS_ONLY", "INVITED_ONLY"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX = 10 * 1024 * 1024;
const VIDEO_MAX = 500 * 1024 * 1024;

interface List {
  id: string;
  name: string;
  membersCount: number;
}

/**
 * A new story: a photo (stored, then published) or a short video (sent straight to Bunny over Tus,
 * published once processed). Audience: everyone, approved followers, contacts or one of my lists.
 */
export function CreateStoryModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [audience, setAudience] = useState<Audience>("PUBLIC");
  const [lists, setLists] = useState<List[]>([]);
  const [listId, setListId] = useState("");
  const [state, setState] = useState<"idle" | "uploading" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [doneMessage, setDoneMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/me/lists", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { lists: [] }))
      .then((d: { lists?: List[] }) => setLists(d.lists ?? []))
      .catch(() => setLists([]));
  }, [isOpen]);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  if (!isOpen) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    setCaption("");
    setAudience("PUBLIC");
    setListId("");
    setState("idle");
    setProgress(0);
    setError(null);
  };
  const closeAll = () => {
    reset();
    onClose();
  };

  const pick = (chosen: File | undefined) => {
    if (!chosen) return;
    const isImage = IMAGE_TYPES.includes(chosen.type);
    const isVideo = chosen.type.startsWith("video/");
    if (!isImage && !isVideo) return setError(t("stories.create.unsupported"));
    if (chosen.size > (isImage ? IMAGE_MAX : VIDEO_MAX)) return setError(t("stories.create.tooLarge"));
    setError(null);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setState("uploading");
    const common = { caption: caption.trim() || null, audience, audienceListId: audience === "INVITED_ONLY" ? listId || null : null };
    try {
      if (IMAGE_TYPES.includes(file.type)) {
        const form = new FormData();
        form.append("category", "stories");
        form.append("file", file);
        const stored = await fetch("/api/uploads", { method: "POST", body: form });
        const storedData = (await stored.json()) as { data?: { ref: string }; error?: string };
        if (!stored.ok || !storedData.data) throw new Error(storedData.error);
        setProgress(70);
        const res = await fetch("/api/stories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...common, imageRef: storedData.data.ref }),
        });
        if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error);
        setDoneMessage(t("stories.create.publishedImage"));
        setState("done");
        onSuccess?.();
        return;
      }

      const res = await fetch("/api/stories/upload-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(common) });
      const data = (await res.json()) as {
        error?: string;
        session?: { tusEndpoint: string; headers: { AuthorizationSignature: string; AuthorizationExpire: number; VideoId: string; LibraryId: string } };
      };
      if (!res.ok || !data.session) throw new Error(data.error);
      const { session } = data;
      await new Promise<void>((resolve, reject) => {
        new tus.Upload(file, {
          endpoint: session.tusEndpoint,
          retryDelays: [0, 3000, 5000, 10000],
          headers: {
            AuthorizationSignature: session.headers.AuthorizationSignature,
            AuthorizationExpire: String(session.headers.AuthorizationExpire),
            VideoId: session.headers.VideoId,
            LibraryId: String(session.headers.LibraryId),
          },
          metadata: { filetype: file.type, title: "story" },
          onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
          onError: reject,
          onSuccess: () => resolve(),
        }).start();
      });
      setDoneMessage(t("stories.create.publishedVideo"));
      setState("done");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("stories.create.failed"));
      setState("idle");
    }
  };

  const isImage = file ? IMAGE_TYPES.includes(file.type) : false;

  if (editing && file && !isImage) {
    return (
      <VideoEditor
        file={file}
        maxSeconds={60}
        defaultVertical
        onClose={() => setEditing(false)}
        onApply={(edited) => {
          setFile(edited);
          setPreview(URL.createObjectURL(edited));
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-md sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="story-title">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 light:border-black/10 bg-zinc-950 light:bg-white p-6 text-white light:text-slate-900 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 light:border-black/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 id="story-title" className="text-base font-bold">{t("stories.create.title")}</h2>
              <p className="text-xs text-zinc-400 light:text-slate-500">{t("stories.create.subtitle")}</p>
            </div>
          </div>
          <button onClick={closeAll} className="rounded-full p-1.5 text-zinc-400 hover:bg-white/5 light:hover:bg-black/5" aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {state === "done" ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
            <p className="mt-4 text-sm text-zinc-300 light:text-slate-700">{doneMessage}</p>
            <button onClick={closeAll} className="mt-6 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white">
              {t("common.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={publish} className="mt-5 space-y-5">
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {file && preview ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/10 light:border-black/10 bg-black">
                {isImage ? <img src={preview} alt="" className="mx-auto max-h-72 object-contain" /> : <video src={preview} className="mx-auto max-h-72" muted playsInline controls />}
                <div className="absolute right-2 top-2 flex gap-1.5">
                  {!isImage && (
                    <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">
                      <Scissors className="h-3 w-3" /> {t("editor.edit")}
                    </button>
                  )}
                  <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
                    {t("stories.create.change")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 light:border-black/10 bg-zinc-900/40 light:bg-slate-50 px-4 py-10 text-center hover:border-violet-500/50"
              >
                <UploadCloud className="h-9 w-9 text-violet-400" />
                <span className="text-sm font-semibold">{t("stories.create.choose")}</span>
                <span className="text-xs text-zinc-500">{t("stories.create.chooseHint")}</span>
              </button>
            )}

            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">
              {t("stories.create.caption")} <span className="normal-case tracking-normal text-zinc-500">— {t("common.optional")}</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder={t("stories.create.captionPlaceholder")}
                className="mt-1.5 w-full resize-none rounded-xl border border-white/10 light:border-black/10 bg-zinc-900 light:bg-slate-50 px-3.5 py-2.5 text-sm normal-case tracking-normal text-white light:text-slate-900 focus:border-violet-500 focus:outline-none"
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 light:text-slate-500">{t("stories.create.audience")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {AUDIENCES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAudience(a)}
                    aria-pressed={audience === a}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                      audience === a ? "border-violet-500 bg-violet-600/15 text-violet-200 light:text-violet-700" : "border-white/10 light:border-black/10 text-zinc-300 light:text-slate-600"
                    }`}
                  >
                    {t(`stories.create.audiences.${a}`)}
                  </button>
                ))}
              </div>
              {audience === "INVITED_ONLY" &&
                (lists.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">{t("stories.create.noList")}</p>
                ) : (
                  <select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    aria-label={t("stories.create.list")}
                    className="mt-2 w-full rounded-xl border border-white/10 light:border-black/10 bg-zinc-900 light:bg-slate-50 px-3 py-2.5 text-sm text-white light:text-slate-900"
                  >
                    <option value="">{t("stories.create.list")}…</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.membersCount})
                      </option>
                    ))}
                  </select>
                ))}
            </fieldset>

            {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}

            <button
              disabled={!file || state === "uploading" || (audience === "INVITED_ONLY" && !listId)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {state === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
              {state === "uploading" ? t("stories.create.uploading", { progress }) : t("stories.create.publish")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
