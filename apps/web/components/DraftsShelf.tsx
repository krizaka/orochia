"use client";

import React, { useEffect, useState } from "react";
import { Clapperboard, Loader2, Music2, Trash2 } from "lucide-react";
import { type DraftKind, type DraftSummary, type OpenedDraft, deleteDraft, listDrafts, openDraft } from "@/lib/drafts";
import { t } from "@/lib/i18n";

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** The creator's drafts of one kind, to continue editing on any device. Renders nothing when there are none. */
export function DraftsShelf({ kind, refresh = 0, onOpen }: { kind: DraftKind; refresh?: number; onOpen: (draft: OpenedDraft) => void }) {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [opening, setOpening] = useState<{ id: string; progress: number } | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listDrafts(kind)
      .then((d) => live && setDrafts(d))
      .catch(() => live && setDrafts([]));
    return () => {
      live = false;
    };
  }, [kind, refresh]);

  if (drafts.length === 0) return null;

  const open = async (draft: DraftSummary) => {
    setError(null);
    setOpening({ id: draft.id, progress: 0 });
    try {
      onOpen(await openDraft(draft, (progress) => setOpening({ id: draft.id, progress })));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t("editor.drafts.failed"));
    } finally {
      setOpening(null);
    }
  };

  const remove = async (id: string) => {
    if (confirming !== id) return setConfirming(id);
    setConfirming(null);
    try {
      await deleteDraft(id);
      setDrafts((all) => all.filter((d) => d.id !== id));
    } catch {
      setError(t("editor.drafts.failed"));
    }
  };

  return (
    <section aria-labelledby={`drafts-${kind}`} className="rounded-2xl border border-accent/25 bg-accent/6 p-3">
      <h3 id={`drafts-${kind}`} className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-accent">
        {t("editor.drafts.title")} · {drafts.length}
      </h3>
      <ul className="flex gap-2.5 overflow-x-auto pb-1">
        {drafts.map((d) => {
          const title = typeof d.details.title === "string" && d.details.title ? d.details.title : typeof d.details.caption === "string" && d.details.caption ? d.details.caption : d.fileName;
          const busy = opening?.id === d.id;
          return (
            <li key={d.id} className="w-36 shrink-0">
              <button
                type="button"
                onClick={() => void open(d)}
                disabled={Boolean(opening)}
                className="group relative block aspect-9/16 max-h-48 w-full overflow-hidden rounded-xl bg-surface-2 text-left"
                aria-label={`${t("editor.drafts.resume")}: ${title}`}
              >
                {d.thumbnailUrl ? (
                  <img src={d.thumbnailUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-zinc-500">
                    <Clapperboard className="h-7 w-7" />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent p-2 pt-6 text-[11px] font-semibold text-white">
                  {busy ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> {t("editor.drafts.opening", { progress: opening.progress })}
                    </span>
                  ) : (
                    <>
                      <span className="line-clamp-2">{title}</span>
                      <span className="mt-0.5 block font-normal text-white/70">{t("editor.drafts.edited", { date: when(d.updatedAt) })}</span>
                    </>
                  )}
                </span>
                {d.hasMusic && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-scrim p-1 text-fg-on-media">
                    <Music2 className="h-3 w-3" />
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => void remove(d.id)}
                onBlur={() => setConfirming(null)}
                className={`mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-semibold ${
                  confirming === d.id ? "bg-danger text-white" : "text-fg-secondary hover:text-danger"
                }`}
              >
                <Trash2 className="h-3 w-3" /> {confirming === d.id ? t("editor.drafts.deleteConfirm") : t("editor.drafts.delete")}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="mt-2 px-1 text-xs text-danger">{error}</p>}
    </section>
  );
}
