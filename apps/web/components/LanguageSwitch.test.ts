import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import en from "../messages/en.json";
import fr from "../messages/fr.json";

const source = readFileSync(join(__dirname, "LanguageSwitch.tsx"), "utf8");

describe("the language switch", () => {
  it("is the family's (a globe and the current code, the languages by their own names), never a button naming the other language", () => {
    expect(source).toContain('from "@krizaka/ui/language-switch"');
    expect(source).toContain("languageNames");
    expect(source).not.toContain("hrefLang=");
    expect(source).not.toContain("window.location.href");
  });

  it("remembers the choice in the family's cookie before the browser opens the same page in that language", () => {
    expect(source).toContain("LOCALE_COOKIE");
    expect(source).toContain("localizedPath(pathname, code)");
  });

  it("is named in both languages", () => {
    expect(en.common.language.label).toBe("Language");
    expect(fr.common.language.label).toBe("Langue");
  });
});
