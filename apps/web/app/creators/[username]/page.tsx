import React from "react";
import { notFound } from "next/navigation";
import { ShieldCheck, Users, Eye, Film } from "lucide-react";
import { VideoCard } from "@/components/VideoCard";
import { creatorByUsername, creatorVideos } from "@/lib/queries";
import { visiblePlaylists } from "@/lib/playlists";
import { getCurrentUser } from "@/lib/auth";
import { RelationshipActions } from "@/components/RelationshipActions";
import { PlaylistCard } from "@/components/PlaylistCard";
import { AVATAR_PLACEHOLDER } from "@/lib/auth-context";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const creator = await creatorByUsername(params.username.toLowerCase()).catch(() => null);
  return {
    title: creator ? `${creator.displayName} (@${creator.username}) — Orochia` : "Creator — Orochia",
    description: creator?.bio ?? "Independent creator on Orochia.",
  };
}

/** A creator's public page: identity, figures and published videos — all from the database. */
export default async function CreatorPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const creator = await creatorByUsername(params.username.toLowerCase());
  if (!creator) notFound();
  const viewer = await getCurrentUser();
  const [videos, playlists] = await Promise.all([creatorVideos(creator.id), visiblePlaylists(creator.id, viewer?.id ?? null)]);

  const stats = [
    { icon: Users, label: "Patrons", value: creator.patrons },
    { icon: Eye, label: "Views", value: creator.totalViews },
    { icon: Film, label: "Videos", value: creator.videosCount },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-violet-950/60 via-zinc-950 to-fuchsia-950/50">
        {creator.bannerUrl && (
          <img src={creator.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
        <div className="relative flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 sm:p-10">
          <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-2 border-violet-500/60 shadow-xl shadow-violet-500/20">
            <img src={creator.avatarUrl || AVATAR_PLACEHOLDER} alt={creator.displayName} className="h-full w-full object-cover" />
          </div>
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white font-display">{creator.displayName}</h1>
              <ShieldCheck className="h-5 w-5 text-violet-400" aria-label="18 U.S.C. § 2257 verified creator" />
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-1">@{creator.username}</p>
            {creator.bio && <p className="mt-3 max-w-2xl text-sm text-zinc-300 leading-relaxed">{creator.bio}</p>}
            <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-5 text-xs font-mono text-zinc-400">
              {stats.map(({ icon: Icon, label, value }) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-violet-400" />
                  <strong className="text-white">{value.toLocaleString("en-US")}</strong> {label}
                </span>
              ))}
            </div>
            <div className="mt-5 flex justify-center sm:justify-start">
              <RelationshipActions username={creator.username} />
            </div>
          </div>
        </div>
      </div>

      {playlists.length > 0 && (
        <>
          <h2 className="mt-10 mb-6 text-xl font-bold text-white">Playlists</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {playlists.map((p) => (
              <PlaylistCard key={p.id} {...p} />
            ))}
          </div>
        </>
      )}

      <h2 className="mt-10 mb-6 text-xl font-bold text-white">Videos</h2>
      {videos.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-zinc-900/40 p-12 text-center text-sm text-zinc-400">
          No published videos yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {videos.map((video) => (
            <VideoCard key={video.id} {...video} />
          ))}
        </div>
      )}
    </div>
  );
}
