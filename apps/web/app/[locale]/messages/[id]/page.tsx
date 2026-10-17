import { notFound } from "next/navigation";

import { MessagesFrame } from "@/components/messages/MessagesFrame";
import { parseConversationId } from "@/lib/conversation-path";

/** `/messages/<id>`: the conversation's address — the link a push notification opens (web and app). */
export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseConversationId((await params).id);
  if (!id) notFound();
  return <MessagesFrame conversationId={id} />;
}
