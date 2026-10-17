import { JoinGroup } from "@/components/messages/JoinGroup";

/** `/messages/join/<token>`: an invitation link to a group. */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  return <JoinGroup token={(await params).token} />;
}
