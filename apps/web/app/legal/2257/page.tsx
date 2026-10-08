import { FileCheck } from "lucide-react";
import { LegalDocument, legalMetadata } from "@/components/legal/LegalDocument";

export const metadata = legalMetadata("records", "/legal/2257");

export default function RecordKeeping2257Page() {
  return <LegalDocument id="records" icon={FileCheck} />;
}
