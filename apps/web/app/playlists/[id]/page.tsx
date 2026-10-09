import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListVideo } from "lucide-react";
import { CollectionAudienceBadge } from "@/components/CollectionAudience";
import { VideoCard } from "@/components/VideoCard";
import { getCurrentUser } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import { playlistWithItems } from "@/lib/playlists";
import type { Metadata } from "next";
import { db, playlists, users } from "@orochia/db";
import { eq } from "drizzle-orm";
import { NOINDEX } from "@/lib/seo";
import { t } from "@/lib/i18n";
import { Rich } from "@/components/Rich";

export const dynamic = "force-dynamic";

/** Only public collections are indexed; the others answer with a neutral, noindex title. */
export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { title: "Collection", robots: NOINDEX };
  const [row] = await db
    .select({ title: playlists.title, description: playlists.description, visibility: playlists.visibility, owner: users.username })
    .from(playlists)
    .innerJoin(users, eq(users.id, playlists.creatorId))
    .where(eq(playlists.id, id))
    .limit(1)
    .catch(() => []);
  if (!row || row.visibility !== "PUBLIC") return { title: "Collection", robots: NOINDEX };
  return {
    title: `${row.title} — a collection by @${row.owner}`,
    description: row.description ?? `A collection of videos curated by @${row.owner} on Orochia.`,
    alternates: { canonical: `/playlists/${id}` },
  };
}

/** A collection, for the viewers its permission admits (others get a 404). Each play is still access-checked. */
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
      <div className="rounded-3xl border border-border-default bg-linear-to-r from-accent/20 via-zinc-950 to-accent-2/15 p-6 sm:p-10">
        <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-accent">
          <ListVideo className="h-3.5 w-3.5" /> {t("collectionPage.eyebrow")} · <CollectionAudienceBadge visibility={playlist.visibility} />
        </p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-black text-fg font-display">{playlist.title}</h1>
        {playlist.description && <p className="mt-2 max-w-2xl text-sm text-fg-secondary">{playlist.description}</p>}
        <p className="mt-3 text-xs text-fg-secondary">
          <Rich
            text={t("collectionPage.by", { name: "{owner}" })}
            slots={{
              owner: (
                <Link href={`/@${playlist.ownerUsername}`} className="text-accent hover:underline">
                  {playlist.ownerName}
                </Link>
              ),
            }}
          />{" "}
          · {t("collectionPage.videos", { count: playlist.itemsCount })}
        </p>
      </div>

      {playlist.items.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-border-default bg-surface-2/40 p-12 text-center text-sm text-fg-secondary">
          {t("collectionPage.empty")}
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
