"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle2, Clapperboard, Eye, Film, Lock, Mail, Scissors, ShieldAlert, Upload, UploadCloud, Users, X } from "lucide-react";
import { VideoEditor } from "./VideoEditor";
import { DraftsShelf } from "./DraftsShelf";
import { useObjectUrl } from "./editor/media";
import { Button, Switch, buttonClass, cx } from "@/components/ui";
import { usd } from "@/components/money/format";
import { useUploadManager } from "@/lib/upload-manager";
import { UPLOAD_LIMITS } from "@orochia/media/limits";
import { EDITOR_MAX_BYTES, type VideoEdit } from "@/lib/video-edit";
import { deleteDraft } from "@/lib/drafts";
import { t, type MessageKey } from "@/lib/i18n";

const LIMIT = UPLOAD_LIMITS.video;
const MAX_TAGS = 12;
const AUDIENCES = ["PUBLIC", "APPROVED_FOLLOWERS_ONLY", "CONTACTS_ONLY", "TIPPED_UNLOCKED", "INVITED_ONLY"] as const;
type Audience = (typeof AUDIENCES)[number];
const AUDIENCE_ICON: Record<Audience, React.ElementType> = { PUBLIC: Eye, APPROVED_FOLLOWERS_ONLY: Users, CONTACTS_ONLY: Mail, TIPPED_UNLOCKED: Lock, INVITED_ONLY: Clapperboard };

const size = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1).replace(/\.0$/, "")} GB` : bytes >= 1024 ** 2 ? `${Math.round(bytes / 1024 ** 2)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const hours = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
};
const clockOf = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** The length of a local video, read by the browser (null when it cannot tell). */
function localDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    probe.preload = "metadata";
    probe.onloadedmetadata = () => done(Number.isFinite(probe.duration) ? probe.duration : null);
    probe.onerror = () => done(null);
    probe.src = url;
  });
}

interface Collection {
  id: string;
  title: string;
}
interface ContentRating {
  id: string;
  label: string;
  description: string;
  isAdult: boolean;
  requiresBlur: boolean;
}

const field =
  "w-full rounded-xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm text-white placeholder:text-zinc-600 transition-colors focus:border-violet-500 focus:outline-hidden light:border-black/10 light:bg-slate-50 light:text-slate-900 light:placeholder:text-slate-400";
const label = "mb-1.5 block text-xs font-semibold text-zinc-300 light:text-slate-700";

/** A numbered step of the form; its number turns into a check once the step is complete. */
function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-950/60 p-5 sm:p-6 light:border-black/5 light:bg-white light:shadow-xs" aria-label={title}>
      <h2 className="mb-4 flex items-center gap-3 text-sm font-bold text-white light:text-slate-900">
        <span
          className={cx(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-black transition-colors duration-300",
            done ? "bg-emerald-500 text-white" : "bg-white/10 text-zinc-300 light:bg-black/5 light:text-slate-600",
          )}
        >
          {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Publish a video, step by step — video (edit it in the browser), details, who can watch (with the price and your
 * share for paid unlocks), content rating, the legal declarations — with a live preview of the card it becomes.
 * The file goes straight to Bunny over Tus through the background upload dock (it keeps going while you browse);
 * the bytes never cross our servers.
 */
export function UploadDropzone({ platformFeePercent }: { platformFeePercent: number }) {
  const { startUpload, uploads } = useUploadManager();
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [visibility, setVisibility] = useState<Audience>("PUBLIC");
  const [minTipAmountDollars, setMinTipAmountDollars] = useState("5.00");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState("");
  const [contentRatings, setContentRatings] = useState<ContentRating[]>([]);
  const [selectedRating, setSelectedRating] = useState("GENERAL");
  const [isBlurred, setIsBlurred] = useState(false);
  const [certify, setCertify] = useState({ age: false, records: false, rights: false });
  const [isDragging, setIsDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [uploadedVideoId, setUploadedVideoId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Non-destructive editing: `source` is the original, reopened with `lastEdit`; `file` is what gets uploaded.
  const [source, setSource] = useState<File | null>(null);
  const [lastEdit, setLastEdit] = useState<VideoEdit | undefined>();
  const [draftId, setDraftId] = useState<string | undefined>();
  const [draftsSeen, setDraftsSeen] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrl = useObjectUrl(file);

  useEffect(() => {
    fetch("/api/playlists", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { playlists: [] }))
      .then((d: { playlists?: Collection[] }) => setCollections(d.playlists ?? []))
      .catch(() => setCollections([]));
    fetch("/api/reference/content-ratings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ratings: [] }))
      .then((d: { ratings?: ContentRating[] }) => d.ratings?.length && setContentRatings(d.ratings))
      .catch(() => setContentRatings([]));
  }, []);

  // Progress comes from the upload dock, which drives the upload (and keeps it going across pages).
  const upload = uploadedVideoId ? uploads.find((u) => u.id === uploadedVideoId) : undefined;
  const uploading = Boolean(upload && upload.status !== "completed" && upload.status !== "error");
  const finished = upload?.status === "completed";

  const pick = async (selected: File | undefined) => {
    if (!selected) return;
    if (!selected.type.startsWith("video/")) return setErrorMessage(t("publish.unsupported"));
    // The server refuses the same limits; checking here spares a long upload for nothing.
    if (selected.size > LIMIT.maxBytes) return setErrorMessage(t("upload.tooLarge", { size: size(selected.size), max: size(LIMIT.maxBytes) }));
    const seconds = await localDuration(selected);
    if (seconds !== null && seconds > LIMIT.maxSeconds) return setErrorMessage(t("upload.tooLong", { duration: hours(seconds), max: hours(LIMIT.maxSeconds) }));
    setErrorMessage(null);
    setDuration(seconds);
    setLastEdit(undefined);
    setDraftId(undefined);
    setSource(selected);
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " "));
  };

  const addTag = (raw: string) => {
    const next = raw
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/^#/, ""))
      .filter(Boolean);
    if (next.length) setTags((all) => [...new Set([...all, ...next])].slice(0, MAX_TAGS));
    setTagDraft("");
  };

  const priceCents = Math.round(parseFloat(minTipAmountDollars || "0") * 100) || 0;
  const feeCents = Math.round((priceCents * platformFeePercent) / 100);
  const certified = certify.age && certify.records && certify.rights;
  const missing = !file ? t("publish.steps.video") : !title.trim() ? t("publish.fields.title") : !certified ? t("publish.steps.declarations") : null;

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || missing) return;
    setStarting(true);
    setErrorMessage(null);
    try {
      // The API checks the creator, records the video and signs a Tus session for Bunny Stream.
      const res = await fetch("/api/videos/create-upload-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description,
          visibility,
          minTipAmountCents: visibility === "TIPPED_UNLOCKED" ? priceCents : 0,
          sizeBytes: file.size,
          tags,
          contentRatingId: selectedRating || null,
          isBlurred,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("settings.failed"));
      const { session, videoId } = data as { session: Parameters<typeof startUpload>[0]["session"]; videoId: string };
      // Filed in the chosen collection now; it shows there once encoding is finished.
      if (selectedCollection) {
        await fetch(`/api/playlists/${selectedCollection}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId }) }).catch(() => undefined);
      }
      setUploadedVideoId(videoId);
      startUpload({
        id: videoId,
        title: title.trim(),
        file,
        session,
        type: "video",
        videoId,
        onSuccess: () => {
          if (draftId) void deleteDraft(draftId).catch(() => undefined);
        },
        onError: (err) => setErrorMessage(err.message || t("settings.failed")),
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t("settings.failed"));
    } finally {
      setStarting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setSource(null);
    setDuration(null);
    setLastEdit(undefined);
    setDraftId(undefined);
    setUploadedVideoId(null);
    setTitle("");
    setDescription("");
    setTags([]);
    setSelectedCollection("");
    setCertify({ age: false, records: false, rights: false });
  };

  if (editing && source) {
    return (
      <VideoEditor
        file={source}
        initialEdit={lastEdit}
        draftId={draftId}
        details={{ title, description, tags: tags.join(", "), visibility, minTipAmountDollars, collectionId: selectedCollection || null }}
        onClose={(savedDraftId) => {
          setEditing(false);
          if (savedDraftId) {
            // Kept as a draft: the form starts over, the draft waits in "Your drafts".
            reset();
            setDraftsSeen((n) => n + 1);
          }
        }}
        onApply={(edited, edit) => {
          setFile(edited);
          setLastEdit(edit);
          setEditing(false);
        }}
      />
    );
  }

  // Sent: what happens next, and the two next steps.
  if (uploadedVideoId && !errorMessage) {
    return (
      <div className="mx-auto max-w-xl rounded-4xl border border-white/10 bg-zinc-950/60 p-8 text-center light:border-black/5 light:bg-white sm:p-12">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-violet-600 to-pink-600 shadow-lg shadow-fuchsia-600/30">
          {finished ? <CheckCircle2 className="h-8 w-8 text-white" /> : <Upload className="h-7 w-7 animate-bounce text-white" />}
        </div>
        <h2 className="font-display text-2xl font-black text-white light:text-slate-900">{t("publish.done.title")}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-400 light:text-slate-600">{t("publish.done.body")}</p>
        {uploading && (
          <div className="mx-auto mt-6 max-w-sm">
            <div className="mb-1.5 flex justify-between text-xs text-zinc-400">
              <span>{t("publish.uploading", { progress: upload?.progress ?? 0 })}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10 light:bg-black/10">
              <div className="h-full rounded-full bg-linear-to-r from-violet-500 to-pink-500 transition-all duration-300" style={{ width: `${upload?.progress ?? 0}%` }} />
            </div>
          </div>
        )}
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href={`/watch/${uploadedVideoId}`} className={buttonClass({ variant: "secondary", size: "lg" })}>
            {t("publish.done.watch")}
          </Link>
          <Button variant="primary" size="lg" onClick={reset}>
            {t("publish.done.another")}
          </Button>
        </div>
      </div>
    );
  }

  const audienceDone = visibility !== "TIPPED_UNLOCKED" || priceCents >= 100;

  return (
    <form onSubmit={publish} className="mx-auto max-w-6xl pb-24 lg:pb-0">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-black tracking-tight text-white light:text-slate-900">{t("publish.title")}</h1>
        <p className="mt-1 text-sm text-zinc-400 light:text-slate-500">{t("publish.subtitle")}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {errorMessage && (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 light:text-rose-700">
              <X className="mt-0.5 h-4 w-4 shrink-0" /> {errorMessage}
            </div>
          )}

          {!file && <DraftsShelf kind="video" refresh={draftsSeen} onOpen={(draft) => {
            const d = draft.details;
            setSource(draft.file);
            setFile(draft.file);
            setDraftId(draft.id);
            setLastEdit(draft.edit);
            setTitle(typeof d.title === "string" && d.title ? d.title : draft.file.name.replace(/\.[^/.]+$/, ""));
            if (typeof d.description === "string") setDescription(d.description);
            if (typeof d.tags === "string") setTags(d.tags.split(",").map((s) => s.trim()).filter(Boolean));
            if (typeof d.visibility === "string" && (AUDIENCES as readonly string[]).includes(d.visibility)) setVisibility(d.visibility as Audience);
            if (typeof d.minTipAmountDollars === "string") setMinTipAmountDollars(d.minTipAmountDollars);
            if (typeof d.collectionId === "string") setSelectedCollection(d.collectionId);
            setEditing(true);
          }} />}

          <Step n={1} title={t("publish.steps.video")} done={Boolean(file)}>
            <input ref={fileInputRef} type="file" accept="video/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
            {file && previewUrl ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <video src={`${previewUrl}#t=0.5`} muted playsInline preload="metadata" className="aspect-video w-full rounded-xl bg-black object-cover sm:w-48" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white light:text-slate-900">{file.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {size(file.size)}
                    {duration !== null && ` · ${clockOf(duration)}`}
                    {lastEdit && <span className="ml-2 rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300 light:text-fuchsia-700">{t("publish.drop.edited")}</span>}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(source?.size ?? 0) <= EDITOR_MAX_BYTES && (
                      <Button size="sm" variant="primary" icon={<Scissors className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
                        {t("publish.drop.edit")}
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                      {t("publish.drop.replace")}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  void pick(e.dataTransfer.files?.[0]);
                }}
                className={cx(
                  "group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400",
                  isDragging ? "scale-[1.01] border-violet-400 bg-violet-500/10" : "border-white/15 hover:border-violet-500/60 hover:bg-violet-500/4 light:border-black/15",
                )}
              >
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-violet-600 to-pink-600 text-white shadow-lg shadow-fuchsia-600/25 transition-transform group-hover:-translate-y-1">
                  <UploadCloud className="h-7 w-7" />
                </span>
                <p className="text-sm font-semibold text-white light:text-slate-900">{isDragging ? t("publish.drop.dragging") : t("publish.drop.title")}</p>
                {!isDragging && (
                  <p className="mt-1 text-sm text-zinc-400 light:text-slate-500">
                    {t("publish.drop.or")} <span className="font-semibold text-violet-300 underline-offset-4 group-hover:underline light:text-violet-700">{t("publish.drop.browse")}</span>
                  </p>
                )}
                <p className="mt-3 text-[11px] text-zinc-500">{t("upload.limits", { size: size(LIMIT.maxBytes), duration: hours(LIMIT.maxSeconds) })}</p>
              </div>
            )}
          </Step>

          <Step n={2} title={t("publish.steps.details")} done={Boolean(title.trim())}>
            <div className="space-y-4">
              <label className="block">
                <span className={`${label} flex justify-between`}>
                  {t("publish.fields.title")} <span className="font-mono font-normal text-zinc-500">{title.length}/120</span>
                </span>
                <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 120))} required placeholder={t("publish.fields.titlePlaceholder")} className={field} />
              </label>
              <label className="block">
                <span className={label}>{t("publish.fields.description")}</span>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("publish.fields.descriptionPlaceholder")} className={`${field} resize-y`} />
              </label>
              <div>
                <span className={label}>{t("publish.fields.tags")}</span>
                <div className={`${field} flex flex-wrap items-center gap-1.5 py-2`} onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}>
                  {tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 rounded-full bg-violet-500/15 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-violet-200 light:text-violet-800">
                      #{tag}
                      <button type="button" aria-label={t("publish.removeTag", { tag })} onClick={() => setTags(tags.filter((x) => x !== tag))} className="rounded-full p-0.5 hover:bg-white/10">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length < MAX_TAGS && (
                    <input
                      value={tagDraft}
                      onChange={(e) => (e.target.value.endsWith(",") ? addTag(e.target.value) : setTagDraft(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(tagDraft);
                        } else if (e.key === "Backspace" && !tagDraft && tags.length) setTags(tags.slice(0, -1));
                      }}
                      onBlur={() => tagDraft && addTag(tagDraft)}
                      placeholder={tags.length ? "" : t("publish.fields.tagsPlaceholder")}
                      aria-label={t("publish.fields.tags")}
                      className="min-w-32 flex-1 bg-transparent py-1 text-sm outline-hidden placeholder:text-zinc-600 light:placeholder:text-slate-400"
                    />
                  )}
                </div>
                <span className="mt-1 block text-[11px] text-zinc-500">{t("publish.fields.tagsHint")}</span>
              </div>
            </div>
          </Step>

          <Step n={3} title={t("publish.steps.audience")} done={audienceDone}>
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t("publish.steps.audience")}>
              {AUDIENCES.map((a) => {
                const Icon = AUDIENCE_ICON[a];
                const active = visibility === a;
                return (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setVisibility(a)}
                    className={cx(
                      "flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-violet-400",
                      active ? "border-violet-500 bg-violet-500/10" : "border-white/10 hover:border-white/25 light:border-black/10 hover:light:border-black/25",
                    )}
                  >
                    <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", active ? "bg-violet-600 text-white" : "bg-white/5 text-zinc-400 light:bg-black/5 light:text-slate-500")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-white light:text-slate-900">{t(`publish.audiences.${a}.title` as MessageKey)}</span>
                      <span className="block text-xs text-zinc-400 light:text-slate-500">{t(`publish.audiences.${a}.hint` as MessageKey)}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {visibility === "TIPPED_UNLOCKED" && (
              <div className="mt-4 rounded-2xl border border-violet-500/25 bg-violet-500/6 p-4">
                <label className="block">
                  <span className={label}>{t("publish.fields.price")}</span>
                  <span className="flex items-center rounded-xl border border-white/10 bg-zinc-900/80 px-3 focus-within:border-violet-500 light:border-black/10 light:bg-white">
                    <span className="font-semibold text-zinc-500">$</span>
                    <input type="number" step="0.50" min="1" value={minTipAmountDollars} onChange={(e) => setMinTipAmountDollars(e.target.value)} className="w-full bg-transparent px-2 py-3 text-sm font-semibold text-white outline-hidden light:text-slate-900" />
                  </span>
                  <span className="mt-1 block text-[11px] text-zinc-500">{t("publish.fields.priceHint")}</span>
                </label>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                  {[
                    { k: t("publish.split.fan"), v: usd(priceCents) },
                    { k: t("publish.split.fee", { fee: platformFeePercent }), v: usd(feeCents) },
                    { k: t("publish.split.you"), v: usd(priceCents - feeCents), strong: true },
                  ].map((c) => (
                    <div key={c.k} className={cx("rounded-xl p-2.5", c.strong ? "bg-emerald-500/15 ring-1 ring-emerald-500/30" : "bg-white/5 light:bg-black/3")}>
                      <span className="block text-zinc-400 light:text-slate-500">{c.k}</span>
                      <span className={cx("font-mono text-sm font-bold", c.strong ? "text-emerald-300 light:text-emerald-700" : "text-white light:text-slate-900")}>{c.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {collections.length > 0 && (
              <label className="mt-4 block">
                <span className={label}>{t("publish.fields.collection")}</span>
                <select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} className={field}>
                  <option value="">{t("publish.fields.noCollection")}</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </Step>

          <Step n={4} title={t("publish.steps.rating")} done={Boolean(selectedRating)}>
            <label className="block">
              <span className={label}>{t("publish.rating.label")}</span>
              <select
                value={selectedRating}
                onChange={(e) => {
                  setSelectedRating(e.target.value);
                  if (contentRatings.find((r) => r.id === e.target.value)?.requiresBlur) setIsBlurred(true);
                }}
                className={field}
              >
                {(contentRatings.length ? contentRatings : [{ id: "GENERAL", label: t("publish.generalAudience"), description: "", isAdult: false, requiresBlur: false }]).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                    {r.isAdult ? " · 18+" : ""}
                  </option>
                ))}
              </select>
              {contentRatings.find((r) => r.id === selectedRating)?.description && (
                <span className="mt-1 block text-[11px] text-zinc-500">{contentRatings.find((r) => r.id === selectedRating)?.description}</span>
              )}
            </label>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-white/10 p-3.5 light:border-black/10">
              <span>
                <span className="block text-sm font-semibold text-white light:text-slate-900">{t("publish.rating.blur")}</span>
                <span className="block text-xs text-zinc-400 light:text-slate-500">{t("publish.rating.blurHint")}</span>
              </span>
              <Switch checked={isBlurred} onChange={setIsBlurred} label={t("publish.rating.blur")} />
            </div>
          </Step>

          <Step n={5} title={t("publish.steps.declarations")} done={certified}>
            <p className="-mt-2 mb-3 flex items-center gap-2 text-xs text-zinc-400 light:text-slate-500">
              <ShieldAlert className="h-3.5 w-3.5 text-fuchsia-400" /> {t("publish.declarations.intro")}
            </p>
            <div className="space-y-2">
              {(["age", "records", "rights"] as const).map((k) => (
                <label key={k} className={cx("flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors", certify[k] ? "border-emerald-500/40 bg-emerald-500/6" : "border-white/10 hover:border-white/25 light:border-black/10")}>
                  <input type="checkbox" checked={certify[k]} onChange={(e) => setCertify({ ...certify, [k]: e.target.checked })} className="mt-0.5 h-4 w-4 accent-violet-600" />
                  <span className="text-sm leading-relaxed text-zinc-200 light:text-slate-700">
                    {t(`publish.declarations.${k}`)}
                    {k === "records" && (
                      <Link href="/legal/2257" target="_blank" className="ml-1 text-violet-300 underline light:text-violet-700">
                        2257
                      </Link>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </Step>
        </div>

        {/* Live preview + publish (sticky on wide screens; the button is pinned to the bottom on phones) */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-white/10 bg-zinc-950/60 p-4 light:border-black/5 light:bg-white">
            <p className="text-xs font-semibold text-zinc-400 light:text-slate-500">{t("publish.preview")}</p>
            <p className="mb-3 text-[11px] text-zinc-500">{t("publish.previewHint")}</p>
            <div className="overflow-hidden rounded-2xl border border-white/10 light:border-black/5">
              <div className="relative aspect-video bg-zinc-900">
                {previewUrl ? (
                  <video src={`${previewUrl}#t=0.5`} muted playsInline preload="metadata" className={cx("h-full w-full object-cover", isBlurred && "scale-110 blur-xl")} />
                ) : (
                  <span className="flex h-full items-center justify-center text-zinc-600">
                    <Film className="h-8 w-8" />
                  </span>
                )}
                {visibility === "TIPPED_UNLOCKED" && (
                  <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-linear-to-r from-violet-600 to-pink-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    <Lock className="h-3 w-3" /> {usd(priceCents)}
                  </span>
                )}
                {duration !== null && <span className="absolute bottom-2 right-2 rounded-sm bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">{clockOf(duration)}</span>}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-semibold text-white light:text-slate-900">{title.trim() || t("publish.untitled")}</p>
                <p className="mt-1 text-[11px] text-zinc-500">{t(`publish.audiences.${visibility}.title` as MessageKey)}{tags.length > 0 && ` · ${tags.slice(0, 3).map((x) => `#${x}`).join(" ")}`}</p>
              </div>
            </div>
          </div>
          <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t border-white/10 bg-zinc-950/90 p-3 backdrop-blur-xl light:border-black/5 light:bg-white/90 md:bottom-0 lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <Button type="submit" variant="primary" size="lg" round={false} className="w-full" disabled={Boolean(missing) || uploading} loading={starting}>
              {uploading ? t("publish.uploading", { progress: upload?.progress ?? 0 }) : missing ? t("publish.missing", { what: missing.toLowerCase() }) : t("publish.submit")}
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}
