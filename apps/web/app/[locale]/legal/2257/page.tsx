import { FileCheck } from "lucide-react";

import { localeFromParams } from "@/lib/i18n-server";
import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  return legalMetadata("records", "/legal/2257");
}

export default async function RecordKeeping2257Page({ params }: { params: Promise<{ locale: string }> }) {
  await localeFromParams(params);
  return <LegalDocument id="records" icon={FileCheck} />;
}
