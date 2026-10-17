import { Shield } from "lucide-react";

import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export const generateMetadata = () => legalMetadata("terms", "/legal/terms");

export default function TermsPage() {
  return <LegalDocument id="terms" icon={Shield} />;
}
