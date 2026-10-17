import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "../proxy";

const call = (path: string, init: Record<string, string> = {}) =>
  proxy(new NextRequest(`https://orochia.com${path}`, { headers: init }));

const forwarded = (response: ReturnType<typeof proxy>, header: string) => response.headers.get(`x-middleware-request-${header}`);

describe("the language of an address", () => {
  it("serves /fr/explore as it is, in French, and remembers the choice in the family's cookie", () => {
    const response = call("/fr/explore?q=neon");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(forwarded(response, "x-locale")).toBe("fr");
    expect(forwarded(response, "x-pathname")).toBe("/explore");
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("fr");
    expect(response.cookies.get("NEXT_LOCALE")?.sameSite).toBe("lax");
  });

  it("serves /fr and /en/legal/terms as the pages of their language", () => {
    expect(forwarded(call("/fr"), "x-locale")).toBe("fr");
    const en = call("/en/legal/terms");
    expect(forwarded(en, "x-locale")).toBe("en");
    expect(en.cookies.get("NEXT_LOCALE")?.value).toBe("en");
  });

  it("serves an address without a language as the page of the reader's language — the cookie first", () => {
    const response = call("/watch/1?t=3", { cookie: "NEXT_LOCALE=fr", "accept-language": "en-US" });
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://orochia.com/fr/watch/1?t=3");
    expect(forwarded(response, "x-pathname")).toBe("/watch/1");
    expect(response.cookies.get("NEXT_LOCALE")).toBeUndefined();
  });

  it("serves the home without a language by the browser's language (a Québec browser gets French), else English", () => {
    expect(call("/", { "accept-language": "fr-CA,fr;q=0.9" }).headers.get("x-middleware-rewrite")).toBe("https://orochia.com/fr");
    expect(call("/", { "accept-language": "en-US" }).headers.get("x-middleware-rewrite")).toBe("https://orochia.com/en");
    expect(call("/explore").headers.get("x-middleware-rewrite")).toBe("https://orochia.com/en/explore");
  });

  it("never lets a visitor set the language by sending the header themselves", () => {
    const response = call("/explore", { "x-locale": "fr" });
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://orochia.com/en/explore");
    expect(forwarded(response, "x-locale")).toBe("en");
  });

  it("leaves a word that only starts like a language alone (/frames is a page of the reader's language)", () => {
    expect(call("/frames").headers.get("x-middleware-rewrite")).toBe("https://orochia.com/en/frames");
  });

  it("keeps the cookie when it already says the language of the address", () => {
    expect(call("/fr/explore", { cookie: "NEXT_LOCALE=fr" }).cookies.get("NEXT_LOCALE")).toBeUndefined();
  });

  it("does not touch the API, the media, the well-known files or the native bot-challenge page", async () => {
    const { config } = await import("../proxy");
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    for (const path of ["/api/health", "/_next/static/a.js", "/.well-known/apple-app-site-association", "/auth/native-challenge", "/robots.txt", "/defaults/avatars/a-256.webp"]) {
      expect(matcher.test(path), path).toBe(false);
    }
    for (const path of ["/", "/explore", "/fr/explore", "/watch/1", "/@ada", "/auth/login"]) expect(matcher.test(path), path).toBe(true);
  });
});
