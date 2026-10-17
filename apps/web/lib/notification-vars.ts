import type { MessageKey } from "./i18n";

/**
 * A notification is stored as an event and its variables, and written in a language when it is read or sent. A variable
 * that is itself words is stored as a key (`i18n:notify.newFollower.asks`) and an amount as cents (`money:1250`), so
 * they are said in the reader's language, not the one of whoever caused the event.
 */
export const i18nVar = (key: MessageKey) => `i18n:${key}`;
export const moneyVar = (cents: number) => `money:${cents}`;
