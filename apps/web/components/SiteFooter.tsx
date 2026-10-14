"use client";

import { SiteFooter as FamilyFooter } from "@krizaka/ui/site-footer";
import Link from "next/link";
import React from "react";

import { BUILD_INFO } from "@/lib/build-info";
import { t } from "@/lib/i18n";

/**
 * The footer of the Krizaka family (NAV-SYS) is @krizaka/ui's SiteFooter: Orochia's own column, the family in
 * columns (@krizaka/ui/sites), « A Krizaka product », the environment and the version, Montréal. The legal links and
 * the 18+ statement end the signature line. On a phone it is where the family is — the bottom tab bar keeps the app.
 */
export function SiteFooter() {
  const link = (href: string, label: string) => (
    <FamilyFooter.Link asChild>
      <Link href={href}>{label}</Link>
    </FamilyFooter.Link>
  );
  return (
    <div className="mb-16 md:mb-0">
      <FamilyFooter
        current="orochia"
        aria-label={t("footer.label")}
        version={BUILD_INFO.sha ? `${BUILD_INFO.version}+${BUILD_INFO.sha}` : BUILD_INFO.version}
        env={BUILD_INFO.env === "production" ? undefined : BUILD_INFO.env}
        data-testid="app-version"
        legal={
          <>
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
