import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/queries";
import { absolute } from "@/lib/seo";

// Read from the database on request (cached an hour): the build never needs one.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const STATIC: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/explore", priority: 0.9, changeFrequency: "daily" },
  { path: "/codex", priority: 0.5, changeFrequency: "weekly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/2257", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/dmca", priority: 0.3, changeFrequency: "yearly" },
];

/** Public pages only: listed videos, their creators, public collections. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics = STATIC.map((s) => ({ url: absolute(s.path), lastModified: now, changeFrequency: s.changeFrequency, priority: s.priority }));
  try {
    const { videos, creators, collections } = await sitemapEntries();
    return [
      ...statics,
      ...creators.map((c) => ({ url: absolute(`/creators/${c.username}`), lastModified: new Date(c.updatedAt), changeFrequency: "weekly" as const, priority: 0.8 })),
      ...videos.map((v) => ({ url: absolute(`/watch/${v.id}`), lastModified: v.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...collections.map((c) => ({ url: absolute(`/playlists/${c.id}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
    ];
  } catch (error) {
    console.error("sitemap: database unavailable, static pages only", error);
    return statics;
  }
}
