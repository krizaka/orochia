import type { MetadataRoute } from "next";

/** The operator console is never indexed: robots.txt shuts the door (and every response says noindex — next.config.mjs). */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
