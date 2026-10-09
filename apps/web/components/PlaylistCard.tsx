import React from "react";
import Link from "next/link";
import { ListVideo } from "lucide-react";
import { CollectionAudienceBadge, type CollectionVisibility } from "./CollectionAudience";

export interface PlaylistCardProps {
  id: string;
  title: string;
  description: string | null;
  visibility: CollectionVisibility;
  itemsCount: number;
  coverUrl: string | null;
}

/** A collection tile: its first video as cover, title, size and who opens it. */
export function PlaylistCard({ id, title, description, visibility, itemsCount, coverUrl }: PlaylistCardProps) {
  return (
    <Link href={`/playlists/${id}`} className="group block overflow-hidden rounded-2xl border border-border-default bg-surface-2/60 transition-all hover:border-accent/40">
      <div className="relative aspect-video bg-linear-to-br from-accent/15 via-zinc-900 to-accent-2/15 light:via-slate-50">
        {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105" />}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-scrim-strong px-2 py-1 font-mono text-[10px] text-fg-on-media">
          <ListVideo className="h-3 w-3" /> {itemsCount}
        </span>
      </div>
      <div className="p-4">
        <p className="truncate text-sm font-bold text-fg">{title}</p>
        {visibility !== "PUBLIC" && <CollectionAudienceBadge visibility={visibility} className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted" />}
        {description && <p className="mt-1 line-clamp-2 text-xs text-fg-secondary">{description}</p>}
      </div>
    </Link>
  );
}
