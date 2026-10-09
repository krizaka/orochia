import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Rich } from "@/components/Rich";
import en from "@/messages/en.json";

import { currentLocale, format, messages, t } from "./i18n";

describe("i18n (bound to @krizaka/i18n)", () => {
  it("reads typed keys and fills their placeholders", () => {
    expect(t("auth.forgot.sent", { email: "a@b.c" })).toBe(en.auth.forgot.sent.replace("{email}", "a@b.c"));
    expect(t("auth.forgot.sent")).toContain("{email}");
    expect(format("{n} views", { n: 3 })).toBe("3 views");
  });

  it("returns a whole branch for structured content", () => {
    expect(messages("legal")).toBe(en.legal);
  });

  it("answers the key itself for a missing key, never an empty string", () => {
    const loose = t as unknown as (key: string) => string;
    expect(loose("nope.missing")).toBe("nope.missing");
  });

  it("formats numbers in en-US", () => {
    expect(currentLocale()).toBe("en-US");
  });

  it("renders <b> with Orochia's emphasis and {slots} as nodes", () => {
    expect(renderToStaticMarkup(createElement(Rich, { text: t("auth.register.ageCertify") }))).toBe(
      'I am at least <strong class="font-semibold text-fg">18 years old</strong>.',
    );
    const html = renderToStaticMarkup(createElement(Rich, { text: t("auth.forgot.sent"), slots: { email: createElement("em", null, "a@b.c") } }));
    expect(html).toContain("<em>a@b.c</em>");
  });
});
