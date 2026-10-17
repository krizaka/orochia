"use client";

import { Eye, Pencil, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { VideoEditSheet } from "@/components/dashboard/VideoEditSheet";
import { Badge, Button, ConfirmButton, undoToast } from "@/components/ui";
import { t } from "@/lib/i18n";
import { compact } from "@/lib/money";
import type { VideoVisibility } from "@/lib/visibility";

export interface OwnedVideo {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  visibility: VideoVisibility;
  minTipAmountCents: number;
  viewsCount: number;
  tipsCount: number;
}

/**
 * The owner's toolbar on the watch page of their own video, in place of "Send a tip" (nobody tips themselves): edit
 * (title, description, visibility, price, tags, audience), the figures, delete with an undo window. Drawn only when the
 * details API says `isOwner`; the PATCH and DELETE behind it match the owner in their query, so a forged request gets 404.
 */
export function OwnerBar({ video, creatorUsername, onSaved }: { video: OwnedVideo; creatorUsername: string; onSaved: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const remove = () => {
    setLeaving(true);
    undoToast(t("studio.withdrawn", { title: video.title }), {
      onUndo: () => setLeaving(false),
      onCommit: () => void fetch(`/api/videos/${video.id}`, { method: "DELETE" }).finally(() => router.push(`/@${creatorUsername}`)),
    });
  };

  return (
    <div data-testid="owner-bar" className="flex flex-wrap items-center gap-2">
      <Badge size="sm" tone="accent">{t("owner.yours")}</Badge>
      <Button variant="secondary" size="sm" shape="rounded" onClick={() => setEditing(true)} disabled={leaving}>
        <Pencil className="h-4 w-4" aria-hidden /> <span>{t("owner.edit")}</span>
      </Button>
      <Link href="/me/videos" className="inline-flex items-center gap-3 rounded-full border border-border-default bg-surface-2/60 px-3 py-1.5 font-mono text-[11px] text-fg-secondary hover:text-fg">
        <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" aria-hidden /> {t("owner.views", { count: compact(video.viewsCount) })}</span>
        <span className="inline-flex items-center gap-1 text-fg-accent"><Sparkles className="h-3 w-3" aria-hidden /> {t("owner.tips", { count: video.tipsCount })}</span>
      </Link>
      <ConfirmButton size="sm" label={t("studio.deleteNamed", { title: video.title })} confirmLabel={t("studio.confirmDelete")} onConfirm={remove}>
        <Trash2 className="h-3.5 w-3.5" />
      </ConfirmButton>
      <VideoEditSheet video={editing ? video : null} onClose={() => setEditing(false)} onSaved={onSaved} />
    </div>
  );
}
