import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const LIVE = /\blive\b/i;

/** Every public string of a seed: orochia never says « live » (nothing is streamed live). */
function publicTexts(dataset) {
  const out = [];
  for (const c of dataset.creators ?? dataset.people ?? []) out.push(["bio", c.bio], ["displayName", c.displayName]);
  for (const v of [...(dataset.videos ?? []), ...(dataset.stories ?? [])]) {
    out.push(["title", v.title], ["description", v.description]);
    for (const t of v.tags ?? []) out.push(["tag", t]);
  }
  return out.filter(([, s]) => typeof s === "string");
}

describe.each([
  ["the dev dataset", "./dev-dataset/dataset.json"],
  ["the demo cast", "./demo/cast.json"],
])("%s", (_name, file) => {
  it("has no public title, description, bio or tag that says « live »", () => {
    const hits = publicTexts(read(file)).filter(([, s]) => LIVE.test(s));
    expect(hits).toEqual([]);
  });
});

// The interface says it too: nothing in Orochia is « live » (a story is « current », « visible for 24 hours »).
// The verb « where you live » is not the claim.
const flat = (o, out = []) => {
  for (const v of Object.values(o)) typeof v === "string" ? out.push(v) : flat(v, out);
  return out;
};
describe.each([
  ["en", /(?<!\b(?:you|I|they|we) )\blive\b/i],
  ["fr", /\b(?:live|en direct)\b/i],
])("the %s catalogue", (lang, rule) => {
  it("has no message that says « live »", () => {
    const texts = flat(read(`../apps/web/messages/${lang}.json`));
    expect(texts.filter((t) => rule.test(t))).toEqual([]);
  });
});
