"use client";

import { ExternalIcon, HomeIcon, SearchIcon } from "@krizaka/icons";
import Link from "next/link";

import { supportHref } from "@/components/errors/links";
import { PageState } from "@/components/errors/PageState";
import { Button, buttonVariants, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

/** Every address no route matches, and every notFound(): the owl reads — it looked everywhere; search from here. */
export default function NotFound() {
  const { t } = useI18n();
  return (
    <>
    {/* A client page cannot export metadata: React hoists these to the document head. */}
    <title>{t("errorPages.notFoundMetaTitle")}</title>
    <meta name="robots" content="noindex" />
    <PageState
      bird="owl"
      mood="thinking"
      eyebrow={t("errorPages.notFoundEyebrow")}
      title={t("errorPages.notFoundTitle")}
      body={t("errorPages.notFoundBody")}
      actions={
        <>
          <Link href="/explore" className={buttonVariants({ variant: "secondary", size: "lg", shape: "pill" })}>
            {t("errorPages.explore")}
          </Link>
          <Link href="/" className={buttonVariants({ variant: "ghost", size: "lg", shape: "pill" })}>
            <HomeIcon size={16} />
            {t("errorPages.home")}
          </Link>
          <a href={supportHref("orochia-not-found")} target="_blank" rel="noopener" className={buttonVariants({ variant: "ghost", size: "lg", shape: "pill" })}>
            {t("errorPages.support")}
            <ExternalIcon size={14} />
          </a>
        </>
      }
    >
      <form action="/explore" role="search" className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon size={18} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-fg-muted" />
          <Input
            name="q"
            type="search"
            maxLength={100}
            placeholder={t("errorPages.searchPlaceholder")}
            aria-label={t("errorPages.searchPlaceholder")}
            className="h-12 rounded-2xl bg-surface-1/90 pl-11 pr-4 shadow-lg backdrop-blur-md"
          />
        </div>
        <Button type="submit" variant="sensual" size="lg" shape="rounded" className="rounded-2xl px-5">
          {t("errorPages.search")}
        </Button>
      </form>
    </PageState>
    </>
  );
}
