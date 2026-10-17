import type { Metadata } from "next";

import { ChangelogBody } from "@/components/ChangelogBody";
import { BUILD_INFO } from "@/lib/build-info";
import { CHANGELOG_REPO, loadReleases } from "@/lib/changelog";
import { getI18n, localeFromParams } from "@/lib/i18n-server";
import { uiVersion } from "@/lib/ui-version";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  await localeFromParams(params);
  const { t } = await getI18n();
  return { title: t("changelog.metaTitle"), description: t("changelog.metaDescription"), alternates: { types: { "application/rss+xml": "/changelog/feed.xml" } } };
}

/** `/changelog` (changelog template): the weeks of merged work, read from GitHub (refreshed hourly). */
export default async function ChangelogPage({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  const { messages } = await getI18n();
  return (
    <main id="content" className="pt-20">
      <ChangelogBody
        c={messages("changelog")}
        releases={await loadReleases()}
        version={BUILD_INFO.version}
        ui={uiVersion()}
        back={{ href: "/", label: "Orochia" }}
        feedHref="/changelog/feed.xml"
        pullsUrl={`https://github.com/${CHANGELOG_REPO}/pulls?q=is%3Apr+is%3Amerged`}
      />
    </main>
  );
}
