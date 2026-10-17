/**
 * A conversation's address. The URL is the state (`/messages/<id>` opens that conversation), and it is the universal
 * link a push notification opens in the app — web and app name the same path.
 */
export const MESSAGES_PATH = "/messages";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function conversationPath(id: string | null): string {
  return id ? `${MESSAGES_PATH}/${id}` : MESSAGES_PATH;
}

/** The conversation id of a path segment, or null when it is not one. */
export function parseConversationId(segment: string | undefined | null): string | null {
  return segment && ID.test(segment) ? segment.toLowerCase() : null;
}
