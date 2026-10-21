"use client";

import { SiteFooter as FamilyFooter } from "@krizaka/ui/site-footer";
import Link from "next/link";
import React from "react";

import { BUILD_INFO } from "@/lib/build-info";
import { format } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-client";
import { localizedPath } from "@/lib/locales";

/**
 * Orochia is independent once deployed: its footer is @krizaka/ui's SiteFooter in product mode (`family={false}`) —
 * Orochia's own column, the publisher line « A Krizaka product » (→ www.krizaka.com), the environment and the version,
 * Montréal. No family columns, no link to another product. The legal links and the 18+ statement end the signature line.
 */
export function SiteFooter({ uiVersion = "", devNotice = false }: { uiVersion?: string; devNotice?: boolean }) {
  const { t, locale } = useI18n();
  const changelog = localizedPath("/changelog", locale);
  const link = (href: string, label: string) => (
    <FamilyFooter.Link asChild>
      <Link href={href}>{label}</Link>
    </FamilyFooter.Link>
  );
  return (
    <div className="mb-16 md:mb-0">
      <FamilyFooter
        current="orochia"
        family={false}
        aria-label={t("footer.label")}
        env={BUILD_INFO.env === "production" ? undefined : BUILD_INFO.env}
        data-testid="app-version"
        legal={
          <>
            {link(`${changelog}#${BUILD_INFO.version}`, `${format(t("changelog.footerVersion"), { version: BUILD_INFO.version })}${uiVersion ? ` · Krizaka UI ${uiVersion}` : ""}`)}
            {devNotice && <span data-testid="dev-environment-notice">{t("footer.devNotice")}</span>}
            <span>{t("footer.adults")}</span>
            {link("/legal/terms", t("footer.terms"))}
            {link("/legal/privacy", t("footer.privacy"))}
            {link("/legal/2257", t("footer.compliance"))}
            {link("/legal/dmca", t("footer.dmca"))}
          </>
        }
      >
        <FamilyFooter.Column title="Orochia">
          {link("/explore", t("footer.explore"))}
          {link("/how-it-works", t("footer.howItWorks"))}
          {link("/mobile", t("footer.mobile"))}
          {link("/docs", t("footer.docs"))}
        </FamilyFooter.Column>
      </FamilyFooter>
    </div>
  );
}
