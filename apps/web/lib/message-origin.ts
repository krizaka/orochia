/**
 * Where a message comes from. A person writes `human`; a reply drafted by an assistant (orazaka-packs#41, the
 * AI-assisted creator replies) is stored `ai_assisted` and always shown with its disclosure. An unknown value reads
 * as `human`: a message is never silently relabelled.
 */
export const MESSAGE_ORIGINS = ["human", "ai_assisted"] as const;
export type MessageOrigin = (typeof MESSAGE_ORIGINS)[number];
export const DEFAULT_MESSAGE_ORIGIN: MessageOrigin = "human";

export function parseMessageOrigin(value: unknown): MessageOrigin {
  return MESSAGE_ORIGINS.includes(value as MessageOrigin) ? (value as MessageOrigin) : DEFAULT_MESSAGE_ORIGIN;
}

export const isAiAssisted = (origin: MessageOrigin): boolean => origin === "ai_assisted";
