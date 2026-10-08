import { AlertCircle } from "lucide-react";
import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export const metadata = legalMetadata("dmca", "/legal/dmca");

export default function DmcaPage() {
  return <LegalDocument id="dmca" icon={AlertCircle} />;
}
