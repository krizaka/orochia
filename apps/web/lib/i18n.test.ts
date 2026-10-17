import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Rich } from "@/components/Rich";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

import { asLocale, getDictionary, toolsFor } from "./i18n";
import { inLocale } from "./i18n-test-utils";

type Tree = { [key: string]: Tree | string | Tree[] | string[] };

function leaves(tree: unknown, path = ""): [string, string][] {
  if (typeof tree === "string") return [[path, tree]];
  if (Array.isArray(tree)) return tree.flatMap((x, i) => leaves(x, `${path}[${i}]`));
  return Object.entries(tree as Tree).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

const enLeaves = leaves(en);
const frLeaves = new Map(leaves(fr));

/** The words of a message: placeholders and markup taken out, so a name in braces is not read as a word. */
const wordsOf = (text: string) => text.replace(/\{[#^/]?\w+\}|<\/?\w+>/g, " ");
/** A whole word, French letters included (a plain \\b would cut « êtes » into « tes »). */
const word = (list: string) => new RegExp(`(?<![\\p{L}])(?:${list})(?![\\p{L}])`, "iu");

describe("i18n (bound to @krizaka/i18n)", () => {
  it("reads typed keys in each language and fills their placeholders", () => {
    expect(toolsFor("en").t("auth.forgot.sent", { email: "a@b.c" })).toBe(en.auth.forgot.sent.replace("{email}", "a@b.c"));
    expect(toolsFor("fr").t("auth.forgot.sent", { email: "a@b.c" })).toBe(fr.auth.forgot.sent.replace("{email}", "a@b.c"));
    expect(toolsFor("en").t("auth.forgot.sent")).toContain("{email}");
  });

  it("returns a whole branch for structured content, in the language asked", () => {
    expect(toolsFor("en").messages("legal")).toBe(en.legal);
    expect(toolsFor("fr").messages("legal")).toBe(fr.legal);
    expect(getDictionary("fr")).toBe(fr);
  });

  it("answers the key itself for a missing key, never an empty string", () => {
    const loose = toolsFor("fr").t as unknown as (key: string) => string;
    expect(loose("nope.missing")).toBe("nope.missing");
  });

  it("falls back to English for any language it does not speak", () => {
    expect(asLocale("de")).toBe("en");
    expect(asLocale("fr")).toBe("fr");
    expect(asLocale(undefined)).toBe("en");
  });

  it("knows its language: a translator carries the locale that formats sizes and dates", () => {
    expect(toolsFor("fr").t.locale).toBe("fr");
    expect(toolsFor("fr").currentLocale()).toBe("fr-CA");
    expect(toolsFor("en").currentLocale()).toBe("en-US");
  });

  it("renders <b> with Orochia's emphasis and {slots} as nodes, in both languages", () => {
    const en18 = renderToStaticMarkup(inLocale("en", createElement(Rich, { text: toolsFor("en").t("auth.register.ageCertify") })));
    expect(en18).toBe('I am at least <strong class="font-semibold text-fg">18 years old</strong>.');
    const fr18 = renderToStaticMarkup(inLocale("fr", createElement(Rich, { text: toolsFor("fr").t("auth.register.ageCertify") })));
    expect(fr18).toBe('J’ai au moins <strong class="font-semibold text-fg">18 ans</strong>.');
    const html = renderToStaticMarkup(createElement(Rich, { text: toolsFor("fr").t("auth.forgot.sent"), slots: { email: createElement("em", null, "a@b.c") } }));
    expect(html).toContain("<em>a@b.c</em>");
  });
});

describe("the French catalogue", () => {
  it("has every key of the English one, and only those", () => {
    expect([...frLeaves.keys()].sort()).toEqual(enLeaves.map(([k]) => k).sort());
  });

  it("is translated, not copied: little of it is identical to the English (brand names, units, cognates)", () => {
    const same = enLeaves.filter(([k, v]) => frLeaves.get(k) === v);
    expect(same.length / enLeaves.length).toBeLessThan(0.06);
  });

  it("keeps every placeholder and every <b> of the English message", () => {
    const placeholders = (s: string) => (s.match(/\{[#^/]?\w+\}/g) ?? []).sort();
    const tags = (s: string) => (s.match(/<\/?\w+>/g) ?? []).sort();
    for (const [key, text] of enLeaves) {
      const french = frLeaves.get(key) ?? "";
      expect(placeholders(french), key).toEqual(placeholders(text));
      expect(tags(french), key).toEqual(tags(text));
    }
  });

  it("speaks Québec French: the family's vocabulary, no anglicism that has its word", () => {
    const refused: [RegExp, string][] = [
      [/e-?mail/i, "courriel"],
      [/hashtag/i, "mot-clic"],
      [/\bupload/i, "téléverser"],
      [/\btips?\b/i, "pourboire"],
      [/\bfollowers?\b/i, "abonné"],
      [/\bwallet\b/i, "portefeuille"],
      [/\bpledges?\b/i, "contribution"],
    ];
    for (const [key, text] of frLeaves) {
      if (key.startsWith("legal.docs.dmca.sections.agent.contact")) continue;
      for (const [pattern, say] of refused) expect(wordsOf(text), `${key} should say « ${say} »`).not.toMatch(pattern);
    }
  });

  it("is written to the reader as « vous », never the casual « tu »", () => {
    for (const [key, text] of frLeaves) expect(wordsOf(text), key).not.toMatch(word("tu|ton|ta|tes|toi"));
  });

  it("carries no English function word (a sentence left half-translated)", () => {
    for (const [key, text] of frLeaves) {
      if (/^(legal\.docs\.(dmca|records)\.sections|stories\.viewer\.errors\.status|home\.visitor\.tour\.caption)/.test(key)) continue;
      expect(wordsOf(text), key).not.toMatch(word("the|your|you|with|from|this|that|and"));
    }
  });

  it("sets the French quotation marks and colons with a no-break space", () => {
    for (const [key, text] of frLeaves) {
      expect(text, key).not.toMatch(/« (?! )|(?<! ) »/);
      expect(text, key).not.toMatch(/\S :(?!\/)/);
    }
  });

  it("counts a French plural set the way French does (0 and 1 are singular)", () => {
    const fr0 = toolsFor("fr").t("stories.views", { count: 0 });
    const fr1 = toolsFor("fr").t("stories.views", { count: 1 });
    const fr2 = toolsFor("fr").t("stories.views", { count: 2 });
    expect([fr0, fr1, fr2]).toEqual(["0 vue", "1 vue", "2 vues"]);
  });

  it("agrees every count in French and in English: « 1 vue », « 0 vue », « 2 vues » — the figure shown apart from the count that picks the form", () => {
    const fr = toolsFor("fr").t;
    const en = toolsFor("en").t;
    expect([0, 1, 2].map((count) => fr("watch.views", { count, shown: String(count) }))).toEqual(["0 vue", "1 vue", "2 vues"]);
    expect([1, 2].map((count) => en("watch.views", { count, shown: String(count) }))).toEqual(["1 view", "2 views"]);
    expect(fr("inbox.unreadCount", { count: 1 })).toBe("1 non lu");
    expect(fr("inbox.unreadCount", { count: 3 })).toBe("3 non lus");
    expect(en("auction.bids", { count: 1 })).toBe("1 bid");
  });

  it("keeps the 18+ gate in plain, neutral words", () => {
    expect(toolsFor("fr").t("card.adult")).toBe("18+");
    expect(toolsFor("fr").t("ageGate.enter")).toBe("J’ai 18 ans ou plus — entrer");
    expect(toolsFor("fr").t("footer.adults")).toContain("18 ans");
  });
});
