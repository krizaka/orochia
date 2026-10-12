"use client";

import { ExternalIcon, HomeIcon } from "@krizaka/icons";
import Link from "next/link";
import { useTransition } from "react";

import { Button, buttonVariants } from "@/components/ui";
import { t } from "@/lib/i18n";

import { ErrorReference } from "./ErrorReference";
import { supportHref } from "./links";
import { PageState } from "./PageState";

/**
 * What a page shows when it failed on the server: the falcon (it watches) says it was on our side and that nothing of
 * the person's is lost, then Try again (Next's `retry`: re-fetch and re-render), Back to home, Contact support — and
 * the error reference to give them. `scope` words the explore page's own boundary.
 */
export function ServerError({ digest, retry, scope = "page", as }: { digest?: string; retry: () => void; scope?: "page" | "explore"; as?: "section" | "main" }) {
  const [pending, startTransition] = useTransition();
  return (
    <PageState
      as={as}
      bird="falcon"
      mood="error"
      eyebrow={t("errorPages.serverEyebrow")}
      title={scope === "explore" ? t("errorPages.exploreTitle") : t("errorPages.serverTitle")}
      body={t("errorPages.serverBody")}
      hint={t("errorPages.serverHint")}
      actions={
        <>
          <Button variant="sensual" size="lg" loading={pending} onClick={() => startTransition(() => retry())}>
            {pending ? t("errorPages.retrying") : t("errorPages.retry")}
          </Button>
          <Link href="/" className={buttonVariants({ variant: "secondary", size: "lg", shape: "pill" })}>
            <HomeIcon size={16} />
            {t("errorPages.home")}
          </Link>
          <a href={supportHref("orochia-error")} target="_blank" rel="noopener" className={buttonVariants({ variant: "ghost", size: "lg", shape: "pill" })}>
            {t("errorPages.support")}
            <ExternalIcon size={14} />
          </a>
        </>
      }
      reference={digest ? <ErrorReference digest={digest} /> : undefined}
    />
  );
}
