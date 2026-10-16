"use client";

import { Gavel } from "lucide-react";
import React, { useState } from "react";

import { Button, cn, Dialog, Input, Select, Sheet, Textarea } from "@/components/ui";
import { t } from "@/lib/i18n";
import type { VideoVisibility } from "@/lib/visibility";
import { CHOOSABLE_VISIBILITIES } from "@/lib/visibility";

import { AudienceEditor } from "../AudienceEditor";

/** What the editor needs of a video (the dashboard's row and the watch page's details both provide it). */
export interface EditableVideo {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  visibility: VideoVisibility;
  minTipAmountCents: number;
}

const visibilityLabel = (v: VideoVisibility) => t(`publish.audiences.${v}.title`);
const field = "mt-1 w-full rounded-xl border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-fg focus:border-accent focus:outline-hidden";
const label = "block text-xs font-semibold text-fg-secondary";

/**
 * Edits a video in a Sheet — title, description, visibility, price, tags, who may watch — wherever the owner is looking
 * at it (the dashboard table, the watch page). The server decides who may: the PATCH matches the owner in its query.
 */
export function VideoEditSheet({ video, onClose, onSaved }: { video: EditableVideo | null; onClose: () => void; onSaved: () => void }) {
  const [visibility, setVisibility] = useState<VideoVisibility>(video?.visibility ?? "PUBLIC");
  const [seen, setSeen] = useState<string | null>(video?.id ?? null);
  if ((video?.id ?? null) !== seen) {
    setSeen(video?.id ?? null);
    if (video) setVisibility(video.visibility);
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = video;
  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const f = new FormData(e.currentTarget);
    const visibility = (f.get("visibility") as VideoVisibility | null) ?? undefined;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/videos/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: String(f.get("title")),
        description: String(f.get("description") || "") || null,
        visibility,
        minTipAmountCents: visibility === undefined ? undefined : visibility === "TIPPED_UNLOCKED" ? Math.round(Number(f.get("price")) * 100) : 0,
        tags: String(f.get("tags") || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? t("studio.saveFailed"));
      return;
    }
    onSaved();
    onClose();
  };


  return (
      <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && onClose()}>
        <Sheet size="md" aria-describedby={undefined}>
          <Dialog.Header>
            <Dialog.Title>{t("studio.editTitle")}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            {editing && (
              <form id="studio-edit" key={editing.id} onSubmit={save} className="space-y-4">
                <label className={label}>
                  {t("studio.title")}
                  <Input name="title" defaultValue={editing.title} required minLength={3} maxLength={255} className="mt-1 rounded-xl" />
                </label>
                <label className={label}>
                  {t("studio.description")}
                  <Textarea name="description" defaultValue={editing.description ?? ""} maxLength={5000} rows={3} className="mt-1 rounded-xl" />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    {t("studio.visibility")}
                    {visibility === "AUCTION" || visibility === "CHALLENGE" ? (
                      <span className={cn(field, "flex items-center gap-1.5 text-fg-secondary")}>
                        <Gavel className="h-3.5 w-3.5" aria-hidden /> {t(visibility === "AUCTION" ? "studio.auctionLocked" : "studio.challengeLocked")}
                      </span>
                    ) : (
                      <Select name="visibility" value={visibility} onChange={(e) => setVisibility(e.target.value as VideoVisibility)} className="mt-1 rounded-xl">
                        {CHOOSABLE_VISIBILITIES.map((value) => <option key={value} value={value}>{visibilityLabel(value)}</option>)}
                      </Select>
                    )}
                  </label>
                  {visibility === "TIPPED_UNLOCKED" && (
                    <label className={label}>
                      {t("studio.price")}
                      <Input name="price" type="number" min={1} step={0.5} defaultValue={Math.max(editing.minTipAmountCents / 100, 5)} className="mt-1 rounded-xl" />
                    </label>
                  )}
                </div>
                <label className={label}>
                  {t("studio.tags")}
                  <Input name="tags" defaultValue={editing.tags.join(", ")} maxLength={500} className="mt-1 rounded-xl" />
                </label>
                {error && <p role="alert" className="text-xs text-fg-danger">{error}</p>}
              </form>
            )}
            {/* Outside the form: the audience editor saves on its own (and has its own form). */}
            {editing && visibility === "INVITED_ONLY" && (
              <div className={cn(label, "mt-4")}>
                {t("studio.audience")}
                <div className="mt-1">
                  <AudienceEditor endpoint={`/api/videos/${editing.id}/audience`} />
                </div>
              </div>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
                        <Button variant="sensual" type="submit" form="studio-edit" loading={busy}>{t("common.save")}</Button>
          </Dialog.Footer>
        </Sheet>
      </Dialog.Root>

  );
}
