"use client";

import { UPLOAD_LIMITS } from "@orochia/media/limits";
import { CheckCircle2, Image as ImageIcon, Scissors, Sparkles, UploadCloud } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";

import { DraftsShelf } from "@/components/DraftsShelf";
import { Button, Checkbox, Chip, cn, Dialog, Select, Sheet, Textarea } from "@/components/ui";
import { VideoEditor } from "@/components/VideoEditor";
import { deleteDraft } from "@/lib/drafts";
import { t } from "@/lib/i18n";
import { EDITOR_MAX_BYTES, type VideoEdit } from "@/lib/video-edit";

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
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && closeAll()}>
      <Sheet size="md">
        <Dialog.Header className="flex-row items-center gap-2.5 border-b border-border-default pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <Dialog.Title>{t("stories.create.title")}</Dialog.Title>
            <Dialog.Description className="text-xs">{t("stories.create.subtitle")}</Dialog.Description>
          </div>
        </Dialog.Header>
        <Dialog.Body>
        {state === "done" ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <p className="mt-4 text-sm text-fg-secondary">{doneMessage}</p>
            <Button variant="primary" shape="rounded" onClick={closeAll} className="mt-6 rounded-xl px-6 font-bold">
              {t("common.close")}
            </Button>
          </div>
        ) : (
          <form onSubmit={publish} className="mt-5 space-y-5">
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            {file && preview ? (
              <div className="relative overflow-hidden rounded-2xl border border-border-default bg-media">
                <div className="mx-auto aspect-9/16 max-h-80">
                  {isImage ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <video src={preview} className="h-full w-full object-cover" muted playsInline controls />}
                </div>
                <div className="absolute right-2 top-2 flex gap-1.5">
                  {!isImage && (
                    <Button variant="primary" size="sm" shape="rounded" onClick={() => setEditing(true)} className="h-7 gap-1 px-2.5">
                      <Scissors className="h-3 w-3" aria-hidden /> {t("stories.create.adjust")}
                    </Button>
                  )}
                  <Button size="sm" shape="rounded" onClick={() => input.current?.click()} className="h-7 border-0 bg-scrim-strong px-2.5 text-fg-on-media hover:bg-scrim-strong">
                    {t("stories.create.change")}
                  </Button>
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
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={280}
                rows={2}
                placeholder={t("stories.create.captionPlaceholder")}
                className="mt-1.5 resize-none rounded-xl px-3.5 py-2.5 normal-case tracking-normal"
              />
            </label>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-secondary">{t("stories.create.audience")}</legend>
              <Chip.Group type="single" required label={t("stories.create.audience")} value={audience} onValueChange={(v) => setAudience(v as typeof audience)} className="grid grid-cols-2 gap-2">
                {AUDIENCES.map((a) => (
                  <Chip key={a} value={a} className="h-auto rounded-xl py-2.5">
                    {t(`stories.create.audiences.${a}`)}
                  </Chip>
                ))}
              </Chip.Group>
              {audience === "INVITED_ONLY" &&
                (lists.length === 0 ? (
                  <p className="mt-2 text-xs text-fg-muted">{t("stories.create.noList")}</p>
                ) : (
                  <Select
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    aria-label={t("stories.create.list")}
                    className="mt-2 rounded-xl px-3 py-2.5"
                  >
                    <option value="">{t("stories.create.list")}…</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.membersCount})
                      </option>
                    ))}
                  </Select>
                ))}
            </fieldset>

            <div className="rounded-xl border border-border-default bg-surface-2/50 p-3 space-y-2.5">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">{t("stories.create.rating")}</span>
                <Select
                  value={ratingId}
                  onChange={(e) => {
                    setRatingId(e.target.value);
                    if (ratings.find((r) => r.id === e.target.value)?.requiresBlur) setIsBlurred(true);
                  }}
                  className="rounded-xl px-3 py-2 text-xs"
                >
                  {ratings.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </label>

              <Checkbox checked={isBlurred} onCheckedChange={(on) => setIsBlurred(on === true)} className="items-center text-xs text-fg-secondary">
                {t("stories.create.blur")}
              </Checkbox>
            </div>

            {error && <p role="alert" className="text-xs text-danger">{error}</p>}

            <Button
              type="submit"
              variant="sensual"
              size="lg"
              shape="rounded"
              disabled={!file || (!isImage && !edited) || (audience === "INVITED_ONLY" && !listId)}
              loading={state === "uploading"}
              className="w-full rounded-2xl font-bold"
            >
              {state !== "uploading" && <ImageIcon className="h-4 w-4" aria-hidden />}
              {state === "uploading" ? t("stories.create.uploading", { progress }) : t("stories.create.publish")}
            </Button>
          </form>
        )}
        </Dialog.Body>
      </Sheet>
    </Dialog.Root>
  );
}
