import type { Metadata } from "next";

import type { Translator } from "./i18n";
import type { Locale } from "./locales";

/**
 * Search and AI discovery: one place for the public origin, the shared metadata and the JSON-LD
 * builders. Only what anyone may see is described — invited-only videos and non-public
 * collections are `noindex` and never appear in the sitemap or the structured data.
 */

/** The public origin. Build time reads it too, so it never throws: production sets NEXT_PUBLIC_APP_URL. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://www.orochia.com").replace(/\/$/, "");
export const SITE_NAME = "Orochia";
/**
 * APP_SEARCH_INDEXING=off (dev and preview environments, read at build time): every page is noindex and
 * robots.txt shuts the door, so only production is indexed — never a duplicate.
 */
export const INDEXABLE = process.env.APP_SEARCH_INDEXING !== "off";
// (the Dockerfile passes APP_SEARCH_INDEXING and NEXT_PUBLIC_APP_URL as build args; robots.txt reads them on request.)
export const KRIZAKA_URL = "https://www.krizaka.com";
/** The Krizaka Organization, defined by www.krizaka.com: every JSON-LD node of the family points back to it. */
export const ORG_ID = `${KRIZAKA_URL}/#organization`;
export const SOURCE_URL = "https://github.com/krizaka/orochia";

export const absolute = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** Pages that must stay out of every index (accounts, studio, private shares). */
export const NOINDEX: Metadata["robots"] = { index: false, follow: false, nocache: true };

/** ISO 8601 duration (PT#M#S) for schema.org. */
export const isoDuration = (seconds: number) => `PT${Math.floor(seconds / 60)}M${Math.floor(seconds % 60)}S`;

const ORGANIZATION = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: "Krizaka",
  url: KRIZAKA_URL,
  sameAs: ["https://github.com/krizaka"],
};

/**
 * The sitewide graph: the site with its search, the application, and who makes it. The words come from the messages
 * (`seo.siteDescription`, `seo.appDescription`: neutral, the age rating is `contentRating`) in the language served.
 */
export function siteGraph(t: Translator, locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZATION,
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: t("seo.siteDescription"),
        publisher: { "@id": ORGANIZATION["@id"] },
        inLanguage: locale,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/explore?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": ["SoftwareApplication", "WebApplication"],
        "@id": `${SITE_URL}/#app`,
        name: SITE_NAME,
        url: SITE_URL,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        description: t("seo.appDescription"),
        isAccessibleForFree: true,
        contentRating: "adult",
        license: "https://www.apache.org/licenses/LICENSE-2.0",
        codeRepository: SOURCE_URL,
        author: { "@id": ORGANIZATION["@id"] },
        publisher: { "@id": ORGANIZATION["@id"] },
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
    ],
  };
}

export interface VideoSchemaInput {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
  createdAt: Date | string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  visibility: string;
  creatorName: string;
  creatorUsername: string;
}

/** A listed video. No stream URL: playback is authorised per viewer and never public. */
export function videoSchema(v: VideoSchemaInput, t: Translator) {
  const url = absolute(`/watch/${v.id}`);
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "@id": url,
    url,
    name: v.title,
    description: v.description || t("seo.videoDescription", { title: v.title, creator: v.creatorName }),
    thumbnailUrl: v.thumbnailUrl ? [v.thumbnailUrl] : undefined,
    uploadDate: new Date(v.createdAt).toISOString(),
    duration: v.durationSeconds > 0 ? isoDuration(v.durationSeconds) : undefined,
    isFamilyFriendly: false,
    contentRating: "adult",
    isAccessibleForFree: v.visibility === "PUBLIC",
    author: { "@type": "Person", name: v.creatorName, url: absolute(`/@${v.creatorUsername}`) },
    publisher: { "@id": `${SITE_URL}/#app` },
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: { "@type": "WatchAction" }, userInteractionCount: v.viewsCount },
      { "@type": "InteractionCounter", interactionType: { "@type": "LikeAction" }, userInteractionCount: v.likesCount },
      { "@type": "InteractionCounter", interactionType: { "@type": "CommentAction" }, userInteractionCount: v.commentsCount },
    ],
  };
}

/** A creator's public page. */
export function profileSchema(c: { username: string; displayName: string; bio: string | null; avatarUrl: string | null; videosCount: number; links?: { url: string }[]; websiteUrl?: string | null }) {
  const url = absolute(`/@${c.username}`);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": url,
    url,
    mainEntity: {
      "@type": "Person",
      name: c.displayName,
      alternateName: `@${c.username}`,
      description: c.bio ?? undefined,
      image: c.avatarUrl ?? undefined,
      url,
      sameAs: [...(c.links ?? []).map((l) => l.url), ...(c.websiteUrl ? [c.websiteUrl] : [])],
      interactionStatistic: { "@type": "InteractionCounter", interactionType: { "@type": "WriteAction" }, userInteractionCount: c.videosCount },
    },
  };
}
