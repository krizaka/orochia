import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendTemplate } from "./mail";
import {
  bunnyReader,
  clearMailTemplateCache,
  escapeHtml,
  fill,
  localReader,
  MAIL_LOCALES,
  MAIL_TEMPLATES,
  MailTemplateError,
  mailTemplateIds,
  mailTemplatesSource,
  type MailVars,
  placeholdersOf,
  renderMailTemplate,
} from "./mail-templates";
import { applyPush, listTemplateFiles, planPush, previewVars, renderAll } from "./mail-templates-tools";

const DIR = path.resolve(__dirname, "..", "mail-templates");
const APP = "https://orochia.test";
const localEnv = { MAIL_TEMPLATES_SOURCE: "local", MAIL_TEMPLATES_DIR: DIR } as unknown as NodeJS.ProcessEnv;
const bunnyEnv = { MAIL_TEMPLATES_SOURCE: "bunny", MAIL_TEMPLATES_DIR: DIR, BUNNY_STORAGE_API_KEY: "key", BUNNY_STORAGE_ZONE: "zone" } as unknown as NodeJS.ProcessEnv;
const resetVars: MailVars<"password-reset"> = { username: "elena", link: "https://orochia.test/auth/reset-password?token=abc" };

beforeEach(() => clearMailTemplateCache());
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("mail templates — the repository's files", () => {
  it("every template exists in every locale, renders with its sample variables, and uses only declared variables", async () => {
    const { rendered, problems } = await renderAll(DIR, APP);
    expect(problems).toEqual([]);
    expect(rendered).toHaveLength(mailTemplateIds().length * MAIL_LOCALES.length);
    for (const { id, locale, mail } of rendered) {
      expect(mail.subject, `${id}/${locale}`).not.toMatch(/[{}]/);
      expect(mail.text, `${id}/${locale}`).not.toMatch(/\{[#^/]?\w+\}/);
      expect(mail.html, `${id}/${locale}`).not.toMatch(/\{[#^/]?\w+\}/);
      expect(mail.html).toContain(`<html lang="${locale}"`);
      expect(mail.html).toContain(`href="${APP}"`);
    }
  });

  it.each(mailTemplateIds().flatMap((id) => MAIL_LOCALES.map((locale) => [id, locale] as const)))("%s (%s) carries its variables", async (id, locale) => {
    const vars = previewVars(DIR, id);
    const mail = await renderMailTemplate(id, vars, { locale, appUrl: APP, env: localEnv });
    expect(mail.locale).toBe(locale);
    for (const [name, kind] of Object.entries(MAIL_TEMPLATES[id])) {
      const value = (vars as Record<string, unknown>)[name];
      if (kind === "text" && value !== "") expect(mail.text, `${id}/${locale} {${name}}`).toContain(String(value));
    }
  });

  it("the French and English texts differ (no untranslated copy)", async () => {
    for (const id of mailTemplateIds()) {
      const vars = previewVars(DIR, id);
      const en = await renderMailTemplate(id, vars, { locale: "en", appUrl: APP, env: localEnv });
      const fr = await renderMailTemplate(id, vars, { locale: "fr", appUrl: APP, env: localEnv });
      expect(fr.text, id).not.toBe(en.text);
    }
  });

  it("publishes the subject, bodies and layout, never the preview samples", () => {
    const files = listTemplateFiles(DIR);
    expect(files).toContain("_layout/layout.html");
    expect(files).toContain("password-reset/fr/subject.txt");
    expect(files.some((f) => f.endsWith("preview.json"))).toBe(false);
  });
});

describe("mail templates — rendering", () => {
  it("escapes variables in HTML, not in plain text and subject", async () => {
    const mail = await renderMailTemplate(
      "content-report-receipt",
      { ticket: "t-1", ticketShort: "t-1", videoTitle: `<script>alert("x")</script> & co`, urgent: false },
      { appUrl: APP, env: localEnv },
    );
    expect(mail.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co");
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain(`<script>alert("x")</script> & co`);
    expect(escapeHtml(`'`)).toBe("&#39;");
  });

  it("opens and closes sections on flags and empty texts", async () => {
    const vars = previewVars(DIR, "content-report-alert");
    const urgent = await renderMailTemplate("content-report-alert", { ...vars, urgent: true, reporterUsername: "" }, { appUrl: APP, env: localEnv });
    expect(urgent.subject.startsWith("[URGENT] ")).toBe(true);
    expect(urgent.text).toContain("(anonymous)");
    const calm = await renderMailTemplate("content-report-alert", { ...vars, urgent: false, reporterUsername: "alex", videoLink: "" }, { appUrl: APP, env: localEnv });
    expect(calm.subject.startsWith("[URGENT]")).toBe(false);
    expect(calm.text).toContain("(@alex)");
    expect(calm.text).toContain("(not matched)");
    const collection = await renderMailTemplate("audience-invitation", { owner: "mia", title: "Trips", link: `${APP}/playlists/1`, isVideo: false }, { appUrl: APP, env: localEnv });
    expect(collection.subject).toBe("@mia shared a collection with you on Orochia");
  });

  it("refuses a missing variable and an unknown one", async () => {
    // A JavaScript caller (or a cast) can still forget one: the render fails instead of sending "{link}".
    const missing = { username: "elena" } as unknown as MailVars<"password-reset">;
    await expect(renderMailTemplate("password-reset", missing, { appUrl: APP, env: localEnv })).rejects.toThrow(/missing variable \{link\}/);
    expect(() => fill("Hi {nobody}", {}, { html: false, allowed: ["username"], name: "t" })).toThrow(MailTemplateError);
    expect(placeholdersOf("{a} {#b}x{/b} {^c}y{/c}")).toEqual(new Set(["a", "b", "c"]));
  });

  it("falls back to English for a locale without its files", async () => {
    const reader = localReader(DIR);
    const onlyEnglish = (p: string) => (p.includes("/fr/") && p.startsWith("password-reset/") ? Promise.resolve(null) : reader(p));
    const mail = await renderMailTemplate("password-reset", resetVars, { locale: "fr", appUrl: APP, env: localEnv, local: onlyEnglish });
    expect(mail.locale).toBe("en");
    expect(mail.subject).toBe("Reset your password — Orochia");
    const unknown = await renderMailTemplate("password-reset", resetVars, { locale: "de" as never, appUrl: APP, env: localEnv });
    expect(unknown.locale).toBe("en");
  });

  it("picks the source: local by default, Bunny by default in production, the variable when set", () => {
    expect(mailTemplatesSource({} as NodeJS.ProcessEnv)).toBe("local");
    expect(mailTemplatesSource({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe("bunny");
    expect(mailTemplatesSource({ NODE_ENV: "production", MAIL_TEMPLATES_SOURCE: "local" } as NodeJS.ProcessEnv)).toBe("local");
    expect(mailTemplatesSource({ MAIL_TEMPLATES_SOURCE: "BUNNY" } as unknown as NodeJS.ProcessEnv)).toBe("bunny");
  });
});

describe("mail templates — Bunny source", () => {
  const bunnyFiles = (overrides: Record<string, string> = {}) => {
    const files: Record<string, string> = {};
    for (const rel of listTemplateFiles(DIR)) files[`mail-templates/${rel}`] = fs.readFileSync(path.join(DIR, rel), "utf8");
    return { ...files, ...overrides };
  };
  const stubBunny = (files: Record<string, string>) => {
    const fetch = vi.fn(async (url: string) => {
      const key = String(url).replace("https://storage.bunnycdn.com/zone/", "");
      return key in files ? new Response(files[key], { status: 200 }) : new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetch);
    return fetch;
  };

  it("renders the version published on Bunny", async () => {
    const fetch = stubBunny(bunnyFiles({ "mail-templates/password-reset/en/subject.txt": "New password for @{username}\n" }));
    const mail = await renderMailTemplate("password-reset", resetVars, { appUrl: APP, env: bunnyEnv });
    expect(mail.source).toBe("bunny");
    expect(mail.subject).toBe("New password for @elena");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/storage\.bunnycdn\.com\/zone\/mail-templates\//);
    expect((init.headers as Record<string, string>).AccessKey).toBe("key");
  });

  it("falls back to the bundled template when Bunny answers 404", async () => {
    stubBunny({});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mail = await renderMailTemplate("password-reset", resetVars, { appUrl: APP, env: bunnyEnv });
    expect(mail.source).toBe("local");
    expect(mail.subject).toBe("Reset your password — Orochia");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("not found on Bunny Storage"));
  });

  it("falls back on a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mail = await renderMailTemplate("password-reset", resetVars, { appUrl: APP, env: bunnyEnv });
    expect(mail.source).toBe("local");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unavailable from Bunny Storage"), "fetch failed");
  });

  it("falls back when the published template is invalid", async () => {
    stubBunny(bunnyFiles({ "mail-templates/password-reset/en/body.txt": "Hi {nobody}" }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mail = await renderMailTemplate("password-reset", resetVars, { appUrl: APP, env: bunnyEnv });
    expect(mail.source).toBe("local");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unavailable from Bunny Storage"), expect.stringContaining("unknown variable {nobody}"));
  });

  it("falls back without credentials", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const mail = await renderMailTemplate("password-reset", resetVars, { appUrl: APP, env: { ...bunnyEnv, BUNNY_STORAGE_API_KEY: "" } });
    expect(mail.source).toBe("local");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("caches files for the TTL, then reads them again", async () => {
    const fetch = stubBunny({ "mail-templates/_layout/layout.txt": "v1" });
    let now = 1_000_000;
    const read = bunnyReader({ env: bunnyEnv, ttlSeconds: 60, now: () => now });
    expect(await read("_layout/layout.txt")).toBe("v1");
    expect(await read("_layout/layout.txt")).toBe("v1");
    expect(await read("missing.txt")).toBeNull();
    expect(await read("missing.txt")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    now += 61_000;
    expect(await read("_layout/layout.txt")).toBe("v1");
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("remembers a failure briefly instead of retrying on every e-mail", async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetch);
    let now = 0;
    const read = bunnyReader({ env: bunnyEnv, ttlSeconds: 300, now: () => now });
    await expect(read("_layout/layout.txt")).rejects.toThrow("fetch failed");
    await expect(read("_layout/layout.txt")).rejects.toThrow("fetch failed");
    expect(fetch).toHaveBeenCalledTimes(1);
    now += 31_000;
    await expect(read("_layout/layout.txt")).rejects.toThrow("fetch failed");
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("mail templates — push", () => {
  it("dry run: compares with Bunny and writes nothing", async () => {
    const files = listTemplateFiles(DIR);
    const layout = fs.readFileSync(path.join(DIR, "_layout/layout.html"), "utf8");
    const remote = vi.fn(async (key: string) => (key === "mail-templates/_layout/layout.html" ? layout : key === "mail-templates/_layout/layout.txt" ? "old" : null));
    const plan = await planPush(DIR, remote);
    expect(plan).toHaveLength(files.length);
    expect(plan.find((e) => e.path === "_layout/layout.html")?.status).toBe("unchanged");
    expect(plan.find((e) => e.path === "_layout/layout.txt")?.status).toBe("changed");
    expect(plan.find((e) => e.path === "password-reset/en/subject.txt")?.status).toBe("new");
    expect(plan.every((e) => e.key === `mail-templates/${e.path}`)).toBe(true);
  });

  it("without credentials lists every file as unknown", async () => {
    const plan = await planPush(DIR, null);
    expect(plan.every((e) => e.status === "unknown")).toBe(true);
  });

  it("apply writes only what differs", async () => {
    const plan = [
      { path: "_layout/layout.txt", key: "mail-templates/_layout/layout.txt", status: "changed" as const },
      { path: "_layout/layout.html", key: "mail-templates/_layout/layout.html", status: "unchanged" as const },
    ];
    const put = vi.fn().mockResolvedValue(undefined);
    expect(await applyPush(DIR, plan, put)).toEqual(["mail-templates/_layout/layout.txt"]);
    expect(put).toHaveBeenCalledWith("mail-templates/_layout/layout.txt", fs.readFileSync(path.join(DIR, "_layout/layout.txt"), "utf8"));
  });

  it("previews are written for every template and locale", async () => {
    const { writePreviews } = await import("./mail-templates-tools");
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "mail-preview-"));
    const { problems } = await writePreviews(DIR, out);
    expect(problems).toEqual([]);
    expect(fs.existsSync(path.join(out, "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(out, "password-reset.fr.html"))).toBe(true);
    fs.rmSync(out, { recursive: true, force: true });
  });
});

describe("sendTemplate", () => {
  it("sends the rendered subject, text and HTML (here to the log: nothing leaves outside production)", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sent = await sendTemplate("password-reset", { to: "elena@example.com", vars: resetVars }, { ...localEnv, NODE_ENV: "test" } as NodeJS.ProcessEnv);
    expect(sent).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(info.mock.calls[0][0]).toContain("Reset your password — Orochia");
    expect(info.mock.calls[0][0]).toContain(resetVars.link);
  });

  it("posts HTML and text in production", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const env = { ...localEnv, NODE_ENV: "production", RESEND_API_KEY: "re_key", NEXT_PUBLIC_APP_URL: APP } as unknown as NodeJS.ProcessEnv;
    vi.stubEnv("NEXT_PUBLIC_APP_URL", APP);
    expect(await sendTemplate("email-verification", { to: "a@example.com", locale: "fr", vars: { username: "a", link: `${APP}/auth/verify?token=x` } }, env)).toBe(true);
    const body = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.subject).toBe("Confirmez votre adresse e-mail — Orochia");
    expect(body.html).toContain('<html lang="fr"');
    expect(body.text).toContain(`${APP}/auth/verify?token=x`);
    vi.unstubAllEnvs();
  });

  it("never throws and sends nothing when the template cannot be rendered", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = { ...localEnv, MAIL_TEMPLATES_DIR: path.join(os.tmpdir(), "no-such-templates") } as NodeJS.ProcessEnv;
    expect(await sendTemplate("password-reset", { to: "a@example.com", vars: resetVars }, env)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it("is the only way the app sends e-mail: no sendMail call outside lib/mail.ts", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!["node_modules", ".next", "mail-templates", ".mail-preview", "public"].includes(entry.name)) walk(full);
        } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !full.endsWith(path.join("lib", "mail.ts"))) {
          if (/\bsendMail\s*\(/.test(fs.readFileSync(full, "utf8"))) offenders.push(path.relative(DIR, full));
        }
      }
    };
    walk(path.resolve(DIR, ".."));
    expect(offenders).toEqual([]);
  });
});
