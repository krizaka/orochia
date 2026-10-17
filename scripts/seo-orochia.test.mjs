// Orochia's side of the Krizaka family SEO contract (scripts/check-seo-family.mjs): robots.txt, sitemap and llms.txt as the
// app really renders them, in both modes — indexed (production) and not indexed (dev, APP_SEARCH_INDEXING=off).
import { afterEach, describe, expect, it, vi } from "vitest";

import { auditLlms, auditRobots, AI_CRAWLERS, ORG_ID } from "./check-seo-family.mjs";

const HOST = "https://orochia.test";

/** MetadataRoute.Robots as the text Next serves. */
function robotsText(r) {
  const groups = [].concat(r.rules).map((rule) => [`User-Agent: ${rule.userAgent}`, ...[].concat(rule.allow ?? []).map((a) => `Allow: ${a}`), ...[].concat(rule.disallow ?? []).map((d) => `Disallow: ${d}`)].join("\n"));
  return `${groups.join("\n\n")}\n${r.sitemap ? `\nSitemap: ${r.sitemap}\n` : ""}`;
}

async function load(env) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", HOST);
  vi.stubEnv("APP_SEARCH_INDEXING", env);
  return { robots: (await import("../apps/web/app/robots.ts")).default, seo: await import("../apps/web/lib/seo.ts"), llms: await import("../apps/web/lib/llms.ts") };
}

afterEach(() => vi.unstubAllEnvs());

describe("orochia: the family SEO contract", () => {
  it("an indexed deployment welcomes every AI crawler and names its sitemap", async () => {
    const { robots } = await load("on");
    expect(auditRobots(robotsText(robots()), { host: HOST, index: true })).toEqual([]);
    for (const bot of AI_CRAWLERS) expect(robotsText(robots())).toContain(`User-Agent: ${bot}\nAllow: /`);
  });

  it("a deployment that is not indexed (dev) shuts the door and advertises no sitemap", async () => {
    const { robots } = await load("off");
    const text = robotsText(robots());
    expect(auditRobots(text, { host: HOST, index: false })).toEqual([]);
    expect(text).not.toMatch(/sitemap/i);
  });

  it("a deployment that is not indexed lists no page in its sitemap", async () => {
    vi.resetModules();
    vi.stubEnv("APP_SEARCH_INDEXING", "off");
    const sitemap = (await import("../apps/web/app/sitemap.ts")).default;
    expect(await sitemap()).toEqual([]);
  });

  it("llms.txt and llms-full.txt follow llmstxt.org, use the deployment's origin and link the family", async () => {
    const { llms } = await load("on");
    for (const text of [llms.llmsText(), llms.llmsFullText()]) {
      expect(auditLlms(text, { host: HOST })).toEqual([]);
      expect(text).not.toMatch(/https:\/\/orochia\.com|https:\/\/krizaka\.com/);
    }
    expect(llms.llmsFullText()).toContain("## Documentation (full text)");
  });

  it("the JSON-LD names the Krizaka Organization on www, and the application is a neutral SoftwareApplication", async () => {
    const { seo } = await load("on");
    const { toolsFor } = await import("../apps/web/lib/i18n.ts");
    const nodes = seo.siteGraph(toolsFor("en").t, "en")["@graph"];
    expect(nodes.find((n) => n["@id"] === ORG_ID)?.url).toBe("https://www.krizaka.com");
    const app = nodes.find((n) => [].concat(n["@type"]).includes("SoftwareApplication"));
    expect(app.publisher).toEqual({ "@id": ORG_ID });
    expect(app.description).not.toMatch(/adult/i);
    expect(JSON.stringify(nodes)).not.toContain("https://krizaka.com");
  });

  it("the JSON-LD speaks the language served, still neutral", async () => {
    const { seo } = await load("on");
    const { toolsFor } = await import("../apps/web/lib/i18n.ts");
    const nodes = seo.siteGraph(toolsFor("fr").t, "fr")["@graph"];
    expect(nodes.find((n) => n["@type"] === "WebSite").inLanguage).toBe("fr");
    const app = nodes.find((n) => [].concat(n["@type"]).includes("SoftwareApplication"));
    expect(app.description).toMatch(/plateforme vidéo/);
    expect(app.description).not.toMatch(/adulte/i);
  });

  it("an indexed sitemap names both addresses of a page, English at the path and French under /fr, hreflang x-default English", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", HOST);
    vi.stubEnv("APP_SEARCH_INDEXING", "on");
    const sitemap = (await import("../apps/web/app/sitemap.ts")).default;
    const entry = (await sitemap()).find((e) => e.url === `${HOST}/explore`);
    expect(entry?.alternates?.languages).toEqual({ en: `${HOST}/explore`, fr: `${HOST}/fr/explore`, "x-default": `${HOST}/explore` });
  });
});

describe("orochia: what the repository says about itself (GitHub ranks first for the name)", () => {
  it("is never called decentralised, and the README opens with a neutral one-liner", async () => {
    const { readFileSync } = await import("node:fs");
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const lore = readFileSync(new URL("../docs/MARKET_ANALYSIS_AND_LORE.md", import.meta.url), "utf8");
    expect(`${readme}\n${lore}`).not.toMatch(/d[ée]centrali[sz]/i);
    const lead = readme.split("<!-- /krizaka-header -->")[0];
    expect(lead).toMatch(/\*\*Orochia — an open-source video platform/);
    expect(lead).not.toMatch(/90 ?%|18\+/);
  });
});
