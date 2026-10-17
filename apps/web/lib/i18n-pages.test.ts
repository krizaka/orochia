import { Shield } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { DevEnvironmentNotice } from "@/components/DevEnvironmentNotice";
import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";
import NotFound from "@/app/not-found";
import { generateMetadata as mobileMetadata } from "@/app/mobile/page";
import { MobileStepCard } from "@/components/mobile/MobileStepCard";

import { serverHtmlIn } from "./i18n-test-utils";

vi.mock("@/lib/i18n-server", () => import("./i18n-test-server"));
vi.mock("next/navigation", () => ({ usePathname: () => "/explore", useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

describe("the key pages render in each language", () => {
  it("renders the legal documents in English and in French, each with its own title", async () => {
    const en = await serverHtmlIn("en", LegalDocument, { id: "terms", icon: Shield });
    const fr = await serverHtmlIn("fr", LegalDocument, { id: "terms", icon: Shield });
    expect(en).toContain("Terms of Service");
    expect(fr).toContain("Conditions d’utilisation");
    expect(fr).not.toContain("Terms of Service");
    expect(fr).toContain("Responsabilités des créateurs");
  });

  it("renders every legal document in French without a trace of the English title", async () => {
    for (const id of ["terms", "privacy", "records", "dmca"] as const) {
      const fr = await serverHtmlIn("fr", LegalDocument, { id, icon: Shield });
      expect(fr, id).toMatch(/[éèà]/);
      expect(fr, id).not.toMatch(/Terms of Service|Privacy policy|record-keeping statement/);
    }
  });

  it("gives the legal pages' metadata in the language of the request", async () => {
    const { setTestLocale } = await import("./i18n-test-server");
    setTestLocale("fr");
    const meta = await legalMetadata("privacy", "/legal/privacy");
    expect(String(meta.title)).toBe("Politique de confidentialité — Orochia");
  });

  it("renders the 404 in the language of the request", async () => {
    const en = await serverHtmlIn("en", NotFound, {});
    const fr = await serverHtmlIn("fr", NotFound, {});
    expect(en).toContain("This page does not exist");
    expect(fr).toContain("Cette page n’existe pas");
    expect(fr).not.toContain("This page does not exist");
  });

  it("renders a step of the mobile journey in French", async () => {
    const fr = await serverHtmlIn("fr", MobileStepCard, { id: "age-gate" as const, index: 0 });
    expect(fr).toContain("Confirmer que vous êtes adulte");
    expect(fr).toContain("Étape 1");
  });

  it("gives the pages' metadata in French, with the canonical and hreflang of the French address", async () => {
    const { setTestLocale } = await import("./i18n-test-server");
    setTestLocale("fr");
    const meta = await mobileMetadata();
    expect(meta.title).toBe("L’appli mobile Orochia");
    expect(meta.alternates?.canonical).toBe("/fr/mobile");
    expect(meta.alternates?.languages).toEqual({ en: "/mobile", fr: "/fr/mobile", "x-default": "/mobile" });
  });

  it("renders a server notice in the language of the request", async () => {
    expect(await serverHtmlIn("fr", DevEnvironmentNotice, {})).toContain("Environnement de développement");
    expect(await serverHtmlIn("en", DevEnvironmentNotice, {})).toContain("Development environment");
  });
});
