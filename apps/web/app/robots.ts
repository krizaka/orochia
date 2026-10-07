import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/seo";

/** Search engines and AI assistants are welcome on the public pages; accounts and the API are not indexed. */
const CRAWLERS = [
  "*",
  "Googlebot",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "DuckDuckBot",
];

// Read on request: the environment (dev / production origin, SEARCH_INDEXING) decides, not the build.
export const dynamic = "force-dynamic";

const DISALLOW = ["/api/", "/dashboard", "/creator/", "/profile", "/auth/"];

export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
