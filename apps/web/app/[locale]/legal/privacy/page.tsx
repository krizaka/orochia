import { Lock } from "lucide-react";

import { localeFromParams } from "@/lib/i18n-server";
import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  return legalMetadata("privacy", "/legal/privacy");
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  return <LegalDocument id="privacy" icon={Lock} />;
}
