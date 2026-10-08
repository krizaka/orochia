import en from "@/messages/en.json";

/**
 * Every user-facing string lives in messages/<locale>.json — English (en.json) is the reference and
 * the only locale for now. Keys are typed from en.json, so a missing or misspelt key fails to compile;
 * a second language adds messages/<locale>.json with the same shape and a locale switch here.
 * Variables: t("stories.views", { count: 3 }) fills {count}.
 */

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<typeof en>;

const dictionary: Record<string, unknown> = en;

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const value = key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dictionary);
  const text = typeof value === "string" ? value : key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : text;
}
