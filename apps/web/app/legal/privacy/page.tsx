import { Lock } from "lucide-react";
import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export const metadata = legalMetadata("privacy", "/legal/privacy");

export default function PrivacyPage() {
  return <LegalDocument id="privacy" icon={Lock} />;
}
