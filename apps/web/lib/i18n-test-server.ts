import { toolsFor, type I18nTools } from "./i18n";
import type { Locale } from "./locales";

/**
 * Stands in for lib/i18n-server.ts in tests (`vi.mock("@/lib/i18n-server", () => import("./i18n-test-server"))`):
 * outside a request there are no headers to read, so the test says which language the "request" is in.
 */
let current: Locale = "en";

export const setTestLocale = (locale: Locale) => {
  current = locale;
};

export const getLocale = async (): Promise<Locale> => current;

export const getI18n = async (): Promise<I18nTools> => toolsFor(current);
