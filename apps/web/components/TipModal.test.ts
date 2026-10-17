import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { money } from "@/lib/format";

const source = readFileSync(new URL("./TipModal.tsx", import.meta.url), "utf8");

describe("the tip dialog's amounts", () => {
  it("fit in French: « 25,00 $ US » is longer than « $25.00 », so the choices sit on two columns in the narrow sheet", () => {
    expect(money(2500, "fr").length).toBeGreaterThan(money(2500, "en").length + 3);
    const grid = /<RadioGroup\.Root[\s\S]*?className="([^"]*)"/.exec(source)?.[1] ?? "";
    expect(grid).toMatch(/\bgrid-cols-2\b/);
    expect(grid).not.toMatch(/(^|\s)grid-cols-4\b/);
  });
});
