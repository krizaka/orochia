"use client";

import React, { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { CheckCircle2, Image as ImageIcon, Loader2, Scissors, Sparkles, UploadCloud, X } from "lucide-react";
import { VideoEditor } from "@/components/VideoEditor";
import { DraftsShelf } from "@/components/DraftsShelf";
import { UPLOAD_LIMITS } from "@orochia/media/limits";
import { EDITOR_MAX_BYTES, type VideoEdit } from "@/lib/video-edit";
import { deleteDraft } from "@/lib/drafts";
import { t } from "@/lib/i18n";

type Audience = "PUBLIC" | "APPROVED_FOLLOWERS_ONLY" | "CONTACTS_ONLY" | "INVITED_ONLY";
const AUDIENCES: Audience[] = ["PUBLIC", "APPROVED_FOLLOWERS_ONLY", "CONTACTS_ONLY", "INVITED_ONLY"];
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX = 10 * 1024 * 1024;

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
  // Story videos always go through the editor (vertical 9:16, 60 seconds at most) before publishing.
  // Editing is non-destructive: `source` is the original clip, reopened with `lastEdit`; `file` is the render.
  const [source, setSource] = useState<File | null>(null);
  const [lastEdit, setLastEdit] = useState<VideoEdit | undefined>();
  const [draftId, setDraftId] = useState<string | undefined>();
  const [edited, setEdited] = useState(false);
  const [draftsSeen, setDraftsSeen] = useState(0);
  const [ratingId, setRatingId] = useState("GENERAL");
  // The ratings come from the reference data (migration 0013) — never hard-coded ids.
  const [ratings, setRatings] = useState<{ id: string; label: string; requiresBlur: boolean }[]>([]);
  useEffect(() => {
    if (!isOpen || ratings.length) return;
    fetch("/api/reference/content-ratings")
      .then((r) => (r.ok ? r.json() : { ratings: [] }))
      .then((d: { ratings?: { id: string; label: string; requiresBlur: boolean }[] }) => setRatings(d.ratings ?? []))
      .catch(() => setRatings([]));
  }, [isOpen, ratings.length]);
  const [isBlurred, setIsBlurred] = useState(false);
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
    setSource(null);
    setLastEdit(undefined);
    setDraftId(undefined);
    setEdited(false);
    setCaption("");
    setAudience("PUBLIC");
    setListId("");
    setRatingId("GENERAL");
    setIsBlurred(false);
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
    if (isImage && chosen.size > IMAGE_MAX) return setError(t("stories.create.tooLarge"));
    if (isVideo && chosen.size > EDITOR_MAX_BYTES) return setError(t("stories.create.tooLargeToEdit"));
    setError(null);
    setFile(chosen);
    setEdited(false);
    setLastEdit(undefined);
    setDraftId(undefined);
    setSource(isVideo ? chosen : null);
    setPreview(URL.createObjectURL(chosen));
    if (isVideo) setEditing(true);
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setState("uploading");
    const common = {
      caption: caption.trim() || null,
      audience,
      audienceListId: audience === "INVITED_ONLY" ? listId || null : null,
      contentRatingId: ratingId || null,
      isBlurred,
    };
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

      const res = await fetch("/api/stories/upload-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...common, sizeBytes: file.size }) });
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
          metadata: { filetype: file.type, title: "story" }, // i18n-ignore: Tus metadata, never shown
          onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
          onError: reject,
          onSuccess: () => resolve(),
        }).start();
      });
      // Published: the draft it came from has served its purpose.
      if (draftId) await deleteDraft(draftId).catch(() => undefined);
      setDoneMessage(t("stories.create.publishedVideo"));
      setState("done");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("stories.create.failed"));
      setState("idle");
    }
  };

  const isImage = file ? IMAGE_TYPES.includes(file.type) : false;

  if (editing && source) {
    return (
      <VideoEditor
        file={source}
        kind="story"
        initialEdit={lastEdit}
        draftId={draftId}
        details={{ caption, audience, audienceListId: listId || null }}
        onClose={(savedDraftId) => {
          setEditing(false);
          if (savedDraftId) {
            // Kept as a draft: back to the start, where the drafts are listed.
            reset();
            setDraftsSeen((n) => n + 1);
          } else if (!edited) {
            setFile(null);
            setPreview(null);
            setSource(null);
          }
        }}
        onApply={(result, edit) => {
          setEditing(false);
          setLastEdit(edit);
          if (result.size > UPLOAD_LIMITS.story.maxBytes) return setError(t("stories.create.tooLarge"));
          setFile(result);
          setEdited(true);
          setPreview(URL.createObjectURL(result));
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim-strong p-0 backdrop-blur-md kz-overlay sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="story-title">
      <div className="kz-dialog max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border-default bg-surface-1 p-6 text-fg shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-default pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 text-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 id="story-title" className="text-base font-bold">{t("stories.create.title")}</h2>
              <p className="text-xs text-fg-secondary">{t("stories.create.subtitle")}</p>
            </div>
          </div>
          <button onClick={closeAll} className="rounded-full p-1.5 text-fg-secondary hover:bg-surface-2" aria-label={t("common.close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {state === "done" ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <p className="mt-4 text-sm text-fg-secondary">{doneMessage}</p>
            <button onClick={closeAll} className="mt-6 rounded-xl bg-accent px-6 py-2.5 text-sm font-bold text-white">
              {t("common.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={publish} className="mt-5 space-y-5">
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {file && preview ? (
              <div className="relative overflow-hidden rounded-2xl border border-border-default bg-black">
                <div className="mx-auto aspect-9/16 max-h-80">
                  {isImage ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <video src={preview} className="h-full w-full object-cover" muted playsInline controls />}
                </div>
                <div className="absolute right-2 top-2 flex gap-1.5">
                  {!isImage && (
                    <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-white">
                      <Scissors className="h-3 w-3" /> {t("stories.create.adjust")}
                    </button>
                  )}
                  <button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-scrim-strong px-2.5 py-1 text-xs font-semibold text-fg-on-media">
                    {t("stories.create.change")}
                  </button>
                </div>
              </div>
            ) : (
              <>
              <DraftsShelf
                kind="story"
                refresh={draftsSeen}
                onOpen={(draft) => {
                  setSource(draft.file);
                  setFile(draft.file);
                  setPreview(URL.createObjectURL(draft.file));
                  setLastEdit(draft.edit);
                  setDraftId(draft.id);
                  setEdited(false);
                  if (typeof draft.details.caption === "string") setCaption(draft.details.caption);
                  if (typeof draft.details.audience === "string" && (AUDIENCES as string[]).includes(draft.details.audience)) setAudience(draft.details.audience as Audience);
                  if (typeof draft.details.audienceListId === "string") setListId(draft.details.audienceListId);
                  setEditing(true);
                }}
              />
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-default bg-surface-2/40 px-4 py-10 text-center hover:border-accent/50"
              >
                <UploadCloud className="h-9 w-9 text-accent" />
                <span className="text-sm font-semibold">{t("stories.create.choose")}</span>
                <span className="text-xs text-fg-muted">{t("stories.create.chooseHint")}</span>
              </button>
              </>
            )}
            {file && !isImage && !edited && <p className="text-xs text-warning">{t("stories.create.editFirst")}</p>}

            <label className="block text-xs font-semibold uppercase tracking-wider text-fg-secondary">
              {t("stories.create.caption")} <span className="normal-case tracking-normal text-fg-muted">— {t("common.optional")}</span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder={t("stories.create.captionPlaceholder")}
                className="mt-1.5 w-full resize-none rounded-xl border border-border-default bg-surface-2 px-3.5 py-2.5 text-sm normal-case tracking-normal text-fg focus:border-accent focus:outline-hidden"
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-secondary">{t("stories.create.audience")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {AUDIENCES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAudience(a)}
                    aria-pressed={audience === a}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold ${
                      audience === a ? "border-accent bg-accent/15 text-accent" : "border-border-default text-fg-secondary"
                    }`}
                  >
                    {t(`stories.create.audiences.${a}`)}
                  </button>
                ))}
              </div>
              {audience === "INVITED_ONLY" &&
                (lists.length === 0 ? (
                  <p className="mt-2 text-xs text-fg-muted">{t("stories.create.noList")}</p>
                ) : (
                  <select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    aria-label={t("stories.create.list")}
                    className="mt-2 w-full rounded-xl border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-fg"
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

            <div className="rounded-xl border border-border-default bg-surface-2/50 p-3 space-y-2.5">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">{t("stories.create.rating")}</span>
                <select
                  value={ratingId}
                  onChange={(e) => {
                    setRatingId(e.target.value);
                    if (ratings.find((r) => r.id === e.target.value)?.requiresBlur) setIsBlurred(true);
                  }}
                  className="w-full rounded-xl border border-border-default bg-surface-2 px-3 py-2 text-xs text-fg"
                >
                  {ratings.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBlurred}
                  onChange={(e) => setIsBlurred(e.target.checked)}
                  className="h-3.5 w-3.5 rounded-sm border-border-strong bg-surface-2 text-accent focus:ring-ring"
                />
                <span className="text-xs text-fg-secondary">{t("stories.create.blur")}</span>
              </label>
            </div>

            {error && <p role="alert" className="text-xs text-danger">{error}</p>}

            <button
              disabled={!file || (!isImage && !edited) || state === "uploading" || (audience === "INVITED_ONLY" && !listId)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-accent via-accent-2 to-accent-2 py-3.5 text-sm font-bold text-white disabled:opacity-40"
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
