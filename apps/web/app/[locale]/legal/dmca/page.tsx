import { AlertCircle } from "lucide-react";

import { localeFromParams } from "@/lib/i18n-server";
import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  return legalMetadata("dmca", "/legal/dmca");
}

export default async function DmcaPage({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  return <LegalDocument id="dmca" icon={AlertCircle} />;
}
