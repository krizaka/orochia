import { ComplianceTable } from "@/console/components/tables";
import { Empty, PageTitle } from "@/console/components/ui";
import { orochia } from "@/console/lib/orochia";

interface Creator {
  id: string;
  username: string;
  email: string;
  displayName: string;
  isVerified: boolean;
  createdAt: string;
  videosCount: number;
}

/**
 * The 18 U.S.C. § 2257 verification queue. Approving records that the creator's identity and age
 * documents were checked; until then the creator cannot open an upload session.
 */
export default async function CompliancePage() {
  const { creators } = await orochia<{ creators: Creator[] }>("/api/admin/creators?verified=false");
  return (
    <div>
      <PageTitle
        title="2257 Creator Verification"
        subtitle="Approve a creator only after their identity and age records have been checked and filed"
      />
      {creators.length === 0 ? (
        <Empty>No creator is waiting for verification.</Empty>
      ) : (
        <ComplianceTable rows={creators} />
      )}
    </div>
  );
}
