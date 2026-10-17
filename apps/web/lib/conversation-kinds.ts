/** The two kinds of conversation and the two roles in one (ADR 0002) — compare to these, never to a string literal. */
export const ConversationKind = { Direct: "direct", Group: "group" } as const;
export type ConversationKindValue = (typeof ConversationKind)[keyof typeof ConversationKind];

export const MemberRole = { Owner: "owner", Member: "member" } as const;
export type MemberRoleValue = (typeof MemberRole)[keyof typeof MemberRole];
