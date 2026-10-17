import { changelogRss } from "@krizaka/ui/changelog-page";

import { loadReleases } from "@/lib/changelog";
import { getDictionary } from "@/lib/i18n";
import { absolute } from "@/lib/seo";

// RSS 2.0 of the changelog (English; the page follows the visitor's language), refreshed hourly from the same pull requests.
export const revalidate = 3600;

export async function GET() {
  const c = getDictionary("en").changelog;
  const page = absolute("/changelog");
  const xml = changelogRss({
    releases: await loadReleases(),
    title: c.feedTitle,
    description: c.feedDescription,
    siteUrl: absolute("/"),
    pageUrl: page,
    feedUrl: `${page}/feed.xml`,
    language: c.langTag,
    tagLabel: c.tags,
  });
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
