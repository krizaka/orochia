import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListVideo, Lock } from "lucide-react";
import { VideoCard } from "@/components/VideoCard";
import { getCurrentUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { playlistWithItems } from "@/lib/playlists";

export const dynamic = "force-dynamic";

/** A playlist: public ones for anyone, private ones for their owner. Each play is still access-checked. */
export default async function PlaylistPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const viewer = await getCurrentUser();
  const playlist = await playlistWithItems(params.id, viewer?.id ?? null).catch((e) => {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  });
  if (!playlist) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-violet-950/60 via-zinc-950 to-fuchsia-950/50 p-6 sm:p-10">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-300">
          <ListVideo className="h-3.5 w-3.5" /> Playlist {playlist.isPrivate && (<><Lock className="h-3 w-3" /> private</>)}
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black text-white font-display">{playlist.title}</h1>
        {playlist.description && <p className="mt-2 max-w-2xl text-sm text-zinc-300">{playlist.description}</p>}
        <p className="mt-3 text-xs text-zinc-400">
          By{" "}
          <Link href={`/creators/${playlist.ownerUsername}`} className="text-violet-300 hover:underline">
            {playlist.ownerName}
          </Link>{" "}
          · {playlist.itemsCount} videos
        </p>
      </div>

      {playlist.items.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-white/10 bg-zinc-900/40 p-12 text-center text-sm text-zinc-400">
          This playlist is empty. Use “Save” on any video to add it.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {playlist.items.map((video) => (
            <VideoCard key={video.id} {...video} />
          ))}
        </div>
      )}
    </div>
  );
}
