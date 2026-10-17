import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("the earnings say what the creator keeps", () => {
  it("states the share she keeps (90 %), computed from the fee setting, in both languages", () => {
    expect(read("./[locale]/me/earnings/page.tsx")).toContain("keep: 100 - s.feePercent");
    expect(JSON.parse(read("../messages/en.json")).earnings.netHint).toMatch(/^You keep \{keep\}%/);
    expect(JSON.parse(read("../messages/fr.json")).earnings.netHint).toMatch(/^Vous gardez \{keep\} %/);
  });
});
