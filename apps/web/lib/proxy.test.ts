import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "../proxy";

const call = (path: string, init: { cookie?: string } = {}) =>
  proxy(new NextRequest(`https://orochia.com${path}`, { headers: init.cookie ? { cookie: init.cookie } : {} }));

const forwarded = (response: ReturnType<typeof proxy>, header: string) => response.headers.get(`x-middleware-request-${header}`);

describe("the language prefix", () => {
  it("serves /fr/explore as /explore in French, and remembers the choice in the family's cookie", () => {
    const response = call("/fr/explore?q=neon");
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://orochia.com/explore?q=neon");
    expect(forwarded(response, "x-locale")).toBe("fr");
    expect(forwarded(response, "x-pathname")).toBe("/explore");
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("fr");
    expect(response.cookies.get("NEXT_LOCALE")?.sameSite).toBe("lax");
  });

  it("serves /fr as the home, and /en/legal/terms as the English terms", () => {
    expect(call("/fr").headers.get("x-middleware-rewrite")).toBe("https://orochia.com/");
    const en = call("/en/legal/terms");
    expect(forwarded(en, "x-locale")).toBe("en");
    expect(en.cookies.get("NEXT_LOCALE")?.value).toBe("en");
  });

  it("does not rewrite an address without a prefix: the cookie or the browser decides, the address is the asked one", () => {
    const response = call("/watch/1");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(forwarded(response, "x-locale")).toBeNull();
    expect(forwarded(response, "x-pathname")).toBe("/watch/1");
  });

  it("never lets a visitor set the language by sending the header themselves", () => {
    const request = new NextRequest("https://orochia.com/explore", { headers: { "x-locale": "fr" } });
    expect(proxy(request).headers.get("x-middleware-request-x-locale")).toBeNull();
  });

  it("leaves a word that only starts like a language alone (/frames)", () => {
    expect(call("/frames").headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("keeps the cookie when it already says the language of the address", () => {
    expect(call("/fr/explore", { cookie: "NEXT_LOCALE=fr" }).cookies.get("NEXT_LOCALE")).toBeUndefined();
  });
});
