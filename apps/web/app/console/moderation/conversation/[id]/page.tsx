import { notFound } from "next/navigation";

import { moderateConversation } from "@/app/console/actions";
import { ConfirmDialog } from "@/console/components/ConfirmDialog";
import { ConversationMessagesTable } from "@/console/components/tables";
import { Empty, PageTitle } from "@/console/components/ui";
import { ApiError, orochia } from "@/console/lib/orochia";

interface Context {
  reportId: string;
  reason: string;
  conversation: { id: string; kind: "direct" | "group"; title: string | null; archivedAt: string | null; members: number };
  reportedMessageId: string;
  messages: { id: string; seq: number; senderId: string; sender: string; content: string; createdAt: string }[];
}

/** The reported message and the ten either side — nothing else of the conversation. */
export default async function ConversationReport(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  let context: Context;
  try {
    context = (await orochia<{ context: Context }>(`/api/admin/reports/${id}/context`)).context;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { conversation, messages } = context;
  const group = conversation.kind === "group";
  return (
    <div>
      <PageTitle
        title={group ? `Group “${conversation.title ?? ""}”` : "Direct conversation"}
        subtitle={`${group ? `${conversation.members} members · ` : ""}the reported message and ten either side${conversation.archivedAt ? " · closed" : ""}`}
      />
      {messages.length === 0 ? (
        <Empty>No message to show.</Empty>
      ) : (
        <ConversationMessagesTable rows={messages} conversationId={conversation.id} group={group} reportedMessageId={context.reportedMessageId} reason={context.reason} />
      )}
      {group && !conversation.archivedAt && (
        <div className="mt-4">
          <ConfirmDialog
            action={moderateConversation}
            fields={{ conversationId: conversation.id, action: "archive", target: "" }}
            trigger={{ label: "Close the group", tone: "danger" }}
            title="Close the group"
            description={<>Nobody can write in it any more; members can still read it.</>}
            reason={{ label: "Reason (recorded)", placeholder: context.reason }}
            confirmLabel="Close the group"
          />
        </div>
      )}
    </div>
  );
}
