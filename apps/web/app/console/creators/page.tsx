import { CreatorsTable } from "@/console/components/tables";
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
  totalTipsEarnedCents: number;
}

export default async function CreatorsPage() {
  const { creators } = await orochia<{ creators: Creator[] }>("/api/admin/creators");
  return (
    <div>
      <PageTitle title="Creator Registry" subtitle="Every creator account, its verification state and its activity" />
      {creators.length === 0 ? (
        <Empty>No creator account yet.</Empty>
      ) : (
        <CreatorsTable rows={creators} />
      )}
    </div>
  );
}
