import React from "react";
import Link from "next/link";
import { ListVideo, Lock } from "lucide-react";

export interface PlaylistCardProps {
  id: string;
  title: string;
  description: string | null;
  isPrivate: boolean;
  itemsCount: number;
  coverUrl: string | null;
}

/** A playlist tile: its first video as cover, title and size. */
export function PlaylistCard({ id, title, description, isPrivate, itemsCount, coverUrl }: PlaylistCardProps) {
  return (
    <Link href={`/playlists/${id}`} className="group block overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60 transition-all hover:border-violet-500/40">
      <div className="relative aspect-video bg-gradient-to-br from-violet-950 via-zinc-900 to-fuchsia-950">
        {coverUrl && <img src={coverUrl} alt="" className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105" />}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 font-mono text-[10px] text-white">
          <ListVideo className="h-3 w-3" /> {itemsCount}
        </span>
      </div>
      <div className="p-4">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold text-white">
          {isPrivate && <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-500" />} {title}
        </p>
        {description && <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{description}</p>}
      </div>
    </Link>
  );
}
