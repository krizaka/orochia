import type { MetadataRoute } from "next";

import { DOCS } from "@/lib/docs";
import { localizedPath } from "@/lib/locales";
import { sitemapEntries } from "@/lib/queries";
import { absolute, INDEXABLE } from "@/lib/seo";

// Read from the database on request (cached an hour): the build never needs one.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

const STATIC: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "yearly" }[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/explore", priority: 0.9, changeFrequency: "daily" },
  { path: "/how-it-works", priority: 0.8, changeFrequency: "weekly" },
  { path: "/mobile", priority: 0.6, changeFrequency: "weekly" },
  { path: "/docs", priority: 0.6, changeFrequency: "weekly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/2257", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/dmca", priority: 0.3, changeFrequency: "yearly" },
];

/** One page, its English address and its French one (`/fr<path>`): each entry names both, as hreflang alternates. */
const page = (path: string) => ({
  url: absolute(path),
  alternates: { languages: { en: absolute(localizedPath(path, "en")), fr: absolute(localizedPath(path, "fr")), "x-default": absolute(localizedPath(path, "en")) } },
});

/** Public pages only: listed videos, their creators, public collections. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A site that is not indexed (dev, preview) lists nothing.
  if (!INDEXABLE) return [];
  const now = new Date();
  const statics = [
    ...STATIC.map((s) => ({ ...page(s.path), lastModified: now, changeFrequency: s.changeFrequency, priority: s.priority })),
    ...DOCS.map((d) => ({ url: absolute(`/docs/${d.slug}`), lastModified: now, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
  try {
    const { videos, creators, collections } = await sitemapEntries();
    return [
      ...statics,
      ...creators.map((c) => ({ ...page(`/@${c.username}`), lastModified: new Date(c.updatedAt), changeFrequency: "weekly" as const, priority: 0.8 })),
      ...videos.map((v) => ({ ...page(`/watch/${v.id}`), lastModified: v.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...collections.map((c) => ({ ...page(`/playlists/${c.id}`), lastModified: c.updatedAt, changeFrequency: "weekly" as const, priority: 0.5 })),
    ];
  } catch (error) {
    console.error("sitemap: database unavailable, static pages only", error);
    return statics;
  }
}
