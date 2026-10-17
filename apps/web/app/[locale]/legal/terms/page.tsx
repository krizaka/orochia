import { Shield } from "lucide-react";

import { localeFromParams } from "@/lib/i18n-server";
import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  return legalMetadata("terms", "/legal/terms");
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  return <LegalDocument id="terms" icon={Shield} />;
}
