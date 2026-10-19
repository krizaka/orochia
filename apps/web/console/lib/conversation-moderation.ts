/** Moderating a reported conversation (Orochia `POST /api/admin/conversations/:id/moderate`): the shapes, as pure functions. */

export const isConversationReport = (r: { messageId?: string | null; videoId?: string | null }): boolean => Boolean(r.messageId) && !r.videoId;

export function moderationBody(action: string, target: string): Record<string, string> {
  if (action === "remove_message") return { action, messageId: target };
  if (action === "remove_member") return { action, userId: target };
  if (action === "archive") return { action };
  throw new Error(`Unknown moderation action: ${action}`);
}
