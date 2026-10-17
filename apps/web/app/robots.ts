import type { MetadataRoute } from "next";
import { INDEXABLE, SITE_URL } from "@/lib/seo";

/** Search engines and AI assistants are welcome on the public pages; accounts and the API are not indexed. The same list
    on every Krizaka site (scripts/check-seo-family.mjs). */
const CRAWLERS = [
  "*",
  "Googlebot", "Google-Extended", "Bingbot", "DuckDuckBot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "Perplexity-User",
  "Claude-SearchBot", "Claude-User", "ClaudeBot", "anthropic-ai", "Applebot", "Applebot-Extended", "CCBot",
];

// Read on request: the environment (dev / production origin, APP_SEARCH_INDEXING) decides, not the build.
export const dynamic = "force-dynamic";

const DISALLOW = ["/api/", "/me/", "/creator/", "/profile", "/auth/"];

export default function robots(): MetadataRoute.Robots {
  // A site that is not indexed (dev, preview) shuts the door and advertises nothing: no sitemap line.
  if (!INDEXABLE) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow: DISALLOW })),
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
