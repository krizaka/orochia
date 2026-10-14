// Orochia's side of the Krizaka family SEO contract (scripts/check-seo-family.mjs): robots.txt, sitemap and llms.txt as the
// app really renders them, in both modes — indexed (production) and not indexed (dev, APP_SEARCH_INDEXING=off).
import { afterEach, describe, expect, it, vi } from "vitest";

import { auditLlms, auditRobots, AI_CRAWLERS, ORG_ID } from "./check-seo-family.mjs";

const HOST = "https://orochia.test";

/** MetadataRoute.Robots as the text Next serves. */
function robotsText(r) {
  const groups = [].concat(r.rules).map((rule) => [`User-Agent: ${rule.userAgent}`, ...[].concat(rule.allow ?? []).map((a) => `Allow: ${a}`), ...[].concat(rule.disallow ?? []).map((d) => `Disallow: ${d}`)].join("\n"));
  return `${groups.join("\n\n")}\n\nSitemap: ${r.sitemap}\n`;
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

  it("a deployment that is not indexed (dev) shuts the door but still names its sitemap", async () => {
    const { robots } = await load("off");
    expect(auditRobots(robotsText(robots()), { host: HOST, index: false })).toEqual([]);
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
    const nodes = seo.siteGraph()["@graph"];
    expect(nodes.find((n) => n["@id"] === ORG_ID)?.url).toBe("https://www.krizaka.com");
    const app = nodes.find((n) => [].concat(n["@type"]).includes("SoftwareApplication"));
    expect(app.publisher).toEqual({ "@id": ORG_ID });
    expect(app.description).not.toMatch(/adult/i);
    expect(JSON.stringify(nodes)).not.toContain("https://krizaka.com");
  });
});
