import { describe, expect, it } from "vitest";

import { intlLocale, localeFromAcceptLanguage, localeOf, localizedPath, ogLocale, stripLocalePrefix } from "./locales";

const headers = (init: Record<string, string>) => new Headers(init);

describe("the language of a request", () => {
  it("is the one a /fr address asked for, before the cookie and the browser", () => {
    expect(localeOf(headers({ "x-locale": "fr", cookie: "NEXT_LOCALE=en", "accept-language": "en-US" }))).toBe("fr");
  });

  it("is the reader's choice (the family's NEXT_LOCALE cookie), before the browser", () => {
    expect(localeOf(headers({ cookie: "kz-theme=dark; NEXT_LOCALE=fr; other=1", "accept-language": "en-US" }))).toBe("fr");
    expect(localeOf(headers({ cookie: "NEXT_LOCALE=en", "accept-language": "fr-CA" }))).toBe("en");
  });

  it("is the browser's when nothing was chosen: French for fr and fr-CA, English for the rest, and for a crawler", () => {
    expect(localeFromAcceptLanguage("fr-CA,fr;q=0.9,en;q=0.8")).toBe("fr");
    expect(localeFromAcceptLanguage("fr")).toBe("fr");
    expect(localeFromAcceptLanguage("en-US,fr;q=0.5")).toBe("en");
    expect(localeFromAcceptLanguage("frisian")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("en");
    expect(localeOf(headers({}))).toBe("en");
  });

  it("ignores a cookie that is not a language", () => {
    expect(localeOf(headers({ cookie: "NEXT_LOCALE=de" }))).toBe("en");
  });
});

describe("addresses in a language", () => {
  it("keeps English at the path itself and puts French under /fr", () => {
    expect(localizedPath("/explore", "en")).toBe("/explore");
    expect(localizedPath("/explore", "fr")).toBe("/fr/explore");
    expect(localizedPath("/", "fr")).toBe("/fr");
    expect(localizedPath("/fr/watch/1", "en")).toBe("/watch/1");
    expect(localizedPath("/fr/watch/1", "fr")).toBe("/fr/watch/1");
    expect(localizedPath("/@ada", "fr")).toBe("/fr/@ada");
  });

  it("takes the prefix off", () => {
    expect(stripLocalePrefix("/fr/explore")).toEqual({ locale: "fr", path: "/explore" });
    expect(stripLocalePrefix("/fr")).toEqual({ locale: "fr", path: "/" });
    expect(stripLocalePrefix("/en/legal/terms")).toEqual({ locale: "en", path: "/legal/terms" });
    expect(stripLocalePrefix("/frames")).toEqual({ locale: null, path: "/frames" });
    expect(stripLocalePrefix("/explore")).toEqual({ locale: null, path: "/explore" });
  });

  it("names Intl and Open Graph locales (Canadian French for Québec)", () => {
    expect(intlLocale("fr")).toBe("fr-CA");
    expect(intlLocale("en")).toBe("en-US");
    expect(ogLocale("fr")).toBe("fr_CA");
  });
});
