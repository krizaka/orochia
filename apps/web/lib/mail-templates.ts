import fs from "fs";
import path from "path";

import { getBunnyConfigObject } from "./storage";

/**
 * E-mail templates (AGENTS.md §3.G). A template is a folder of `apps/web/mail-templates/<id>/`, one
 * sub-folder per locale holding `subject.txt`, `body.html` and `body.txt`, rendered inside the shared layout
 * (`_layout/layout.html` / `layout.txt` + `_layout/<locale>/footer.txt`). The words live in those files, never in code.
 *
 * Syntax: `{name}` inserts a variable (HTML-escaped in `.html` files); `{#name}…{/name}` keeps its content when the
 * variable is set (true, a non-empty text, a non-zero number) and `{^name}…{/name}` when it is not.
 *
 * Source: `MAIL_TEMPLATES_SOURCE=local|bunny` — the files of this repository (the reference, bundled in the image), or
 * the same tree under `mail-templates/` in the Bunny Storage zone, cached in memory (`MAIL_TEMPLATES_CACHE_TTL`
 * seconds). A template missing, unreachable or invalid on Bunny falls back to the bundled one, with a warning.
 */

// ── Registry: every template and its variables ─────────────────────────────────────────────────

/** `text` variables are inserted (string or number); `flag` variables only open or close `{#…}` sections. */
type VarKind = "text" | "flag";

export const MAIL_TEMPLATES = {
  "email-verification": { username: "text", link: "text" },
  "password-reset": { username: "text", link: "text" },
  invitation: { inviterName: "text", inviterUsername: "text", link: "text", expiresInDays: "text" },
  "audience-invitation": { owner: "text", title: "text", link: "text", isVideo: "flag" },
  "content-report-alert": {
    ticket: "text",
    reason: "text",
    urgent: "flag",
    videoTitle: "text",
    videoLink: "text",
    reporterEmail: "text",
    reporterUsername: "text",
    details: "text",
  },
  "content-report-receipt": { ticket: "text", ticketShort: "text", videoTitle: "text", urgent: "flag" },
  notification: { username: "text", subject: "text", body: "text", link: "text", settingsLink: "text" },
} as const satisfies Record<string, Record<string, VarKind>>;

export type MailTemplateId = keyof typeof MAIL_TEMPLATES;
type VarValue<K> = K extends "flag" ? boolean : string | number;
/** The variables of a template — all required, so a call that misses one does not compile. */
export type MailVars<Id extends MailTemplateId> = { [K in keyof (typeof MAIL_TEMPLATES)[Id]]: VarValue<(typeof MAIL_TEMPLATES)[Id][K]> };

export const MAIL_LOCALES = ["en", "fr"] as const;
export type MailLocale = (typeof MAIL_LOCALES)[number];
export const DEFAULT_MAIL_LOCALE: MailLocale = "en";

export const mailTemplateIds = () => Object.keys(MAIL_TEMPLATES) as MailTemplateId[];

/** Variables the layout receives, besides the template's own. */
const LAYOUT_VARS = ["content", "subject", "lang", "footer", "appUrl", "year"] as const;

// ── Rendering ──────────────────────────────────────────────────────────────────────────────────

export class MailTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MailTemplateError";
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const SECTION = /\{([#^])([A-Za-z]\w*)\}([\s\S]*?)\{\/\2\}/g;
const PLACEHOLDER = /\{([A-Za-z]\w*)\}/g;

/** The variable names a template text refers to (sections included). */
export function placeholdersOf(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(/\{[#^/]?([A-Za-z]\w*)\}/g)) names.add(m[1]);
  return names;
}

type Values = Record<string, string | number | boolean>;
const isSet = (v: string | number | boolean | undefined) => v !== undefined && v !== false && v !== "" && v !== 0;

/**
 * Fills one template text. Every placeholder must be an allowed variable and have a value; `raw` names are inserted
 * as they are (the layout's `content`), the others are escaped when `html` is true.
 */
export function fill(source: string, values: Values, options: { html: boolean; allowed: Iterable<string>; raw?: string[]; name: string }): string {
  const allowed = new Set(options.allowed);
  for (const name of placeholdersOf(source)) {
    if (!allowed.has(name)) throw new MailTemplateError(`${options.name}: unknown variable {${name}}`);
  }
  let out = source;
  // Innermost sections first, so a section can hold another one.
  for (let guard = 0; guard < 20 && SECTION.test(out); guard++) {
    SECTION.lastIndex = 0;
    out = out.replace(SECTION, (_, mode: string, name: string, body: string) => (isSet(values[name]) === (mode === "#") ? body : ""));
  }
  SECTION.lastIndex = 0;
  return out.replace(PLACEHOLDER, (_, name: string) => {
    const value = values[name];
    if (value === undefined || value === null) throw new MailTemplateError(`${options.name}: missing variable {${name}}`);
    if (typeof value === "boolean") throw new MailTemplateError(`${options.name}: {${name}} is a flag, use it as {#${name}}…{/${name}}`);
    const text = String(value);
    return options.html && !options.raw?.includes(name) ? escapeHtml(text) : text;
  });
}

/** The files a rendering needs, relative to the templates root. */
export interface TemplateFiles {
  subject: string;
  html: string;
  text: string;
  layoutHtml: string;
  layoutText: string;
  footer: string;
}

export const templatePaths = (id: string, locale: string) => ({
  subject: `${id}/${locale}/subject.txt`,
  html: `${id}/${locale}/body.html`,
  text: `${id}/${locale}/body.txt`,
  layoutHtml: "_layout/layout.html",
  layoutText: "_layout/layout.txt",
  footer: `_layout/${locale}/footer.txt`,
});

export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

/** Renders a template's files with its variables, inside the layout. Throws MailTemplateError on an invalid template. */
export function renderFiles(id: MailTemplateId, locale: string, files: TemplateFiles, vars: Values, appUrl: string, now = new Date()): RenderedMail {
  const allowed = Object.keys(MAIL_TEMPLATES[id]);
  for (const name of allowed) {
    if (vars[name] === undefined || vars[name] === null) throw new MailTemplateError(`${id}: missing variable {${name}}`);
  }
  const name = `${id}/${locale}`;
  const subject = fill(files.subject, vars, { html: false, allowed, name: `${name}/subject.txt` }).replace(/\s+/g, " ").trim();
  if (!subject) throw new MailTemplateError(`${name}/subject.txt: empty subject`);
  const layout: Values = { subject, lang: locale, appUrl, year: now.getUTCFullYear() };
  const footer = fill(files.footer, layout, { html: false, allowed: ["appUrl", "year"], name: `_layout/${locale}/footer.txt` }).trim();
  const htmlBody = fill(files.html, vars, { html: true, allowed, name: `${name}/body.html` });
  const textBody = fill(files.text, vars, { html: false, allowed, name: `${name}/body.txt` }).trim();
  const html = fill(files.layoutHtml, { ...layout, footer, content: htmlBody }, { html: true, allowed: LAYOUT_VARS, raw: ["content"], name: "_layout/layout.html" });
  const text = fill(files.layoutText, { ...layout, footer, content: textBody }, { html: false, allowed: LAYOUT_VARS, name: "_layout/layout.txt" }).trim() + "\n";
  return { subject, html, text };
}

// ── Sources ────────────────────────────────────────────────────────────────────────────────────

export type MailTemplatesSource = "local" | "bunny";

/**
 * Where templates are read from: MAIL_TEMPLATES_SOURCE, or by default Bunny in production and the repository
 * elsewhere (the media storage rule: container disks are not where production content is edited).
 */
export function mailTemplatesSource(env: NodeJS.ProcessEnv = process.env): MailTemplatesSource {
  const value = env.MAIL_TEMPLATES_SOURCE?.trim().toLowerCase();
  if (value === "bunny" || value === "local") return value;
  return env.NODE_ENV === "production" ? "bunny" : "local";
}

/** The bundled templates: MAIL_TEMPLATES_DIR, else `mail-templates/` next to the app (dev, standalone image, tests). */
export function localTemplatesDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.MAIL_TEMPLATES_DIR) return path.resolve(env.MAIL_TEMPLATES_DIR);
  const cwd = process.cwd();
  const candidates = [path.join(/* turbopackIgnore: true */ cwd, "mail-templates"), path.join(/* turbopackIgnore: true */ cwd, "apps", "web", "mail-templates")];
  return candidates.find((dir) => fs.existsSync(path.join(dir, "_layout"))) ?? candidates[0];
}

/** Reads one file of the tree, or null when it does not exist. */
export type TemplateReader = (relativePath: string) => Promise<string | null>;

export function localReader(dir = localTemplatesDir()): TemplateReader {
  return async (relativePath) => {
    // Not traced by the bundler: the image copies mail-templates/ next to the server (deploy/docker/Dockerfile).
    const file = path.join(/* turbopackIgnore: true */ dir, relativePath);
    if (!file.startsWith(dir + path.sep)) return null;
    try {
      return await fs.promises.readFile(/* turbopackIgnore: true */ file, "utf8");
    } catch {
      return null;
    }
  };
}

export const BUNNY_TEMPLATES_PREFIX = "mail-templates";

interface CacheEntry {
  value: string | null;
  error?: unknown;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

/** Forgets the cached Bunny templates (tests, and after a push in the same process). */
export function clearMailTemplateCache() {
  cache.clear();
}

/**
 * Reads from `mail-templates/` in the Bunny Storage zone, through a memory cache: found and missing files are kept
 * `ttlSeconds`; a failure is remembered for at most 30 s so an outage does not slow every e-mail down.
 */
export function bunnyReader(options: { env?: NodeJS.ProcessEnv; ttlSeconds?: number; now?: () => number } = {}): TemplateReader {
  const env = options.env ?? process.env;
  const ttl = (options.ttlSeconds ?? cacheTtlSeconds(env)) * 1000;
  const now = options.now ?? Date.now;
  return async (relativePath) => {
    const key = `${BUNNY_TEMPLATES_PREFIX}/${relativePath}`;
    const hit = cache.get(key);
    if (hit && hit.expiresAt > now()) {
      if (hit.error) throw hit.error;
      return hit.value;
    }
    try {
      const value = await getBunnyConfigObject(key, { env });
      cache.set(key, { value, expiresAt: now() + ttl });
      return value;
    } catch (error) {
      cache.set(key, { value: null, error, expiresAt: now() + Math.min(ttl, 30_000) });
      throw error;
    }
  };
}

function cacheTtlSeconds(env: NodeJS.ProcessEnv): number {
  const value = Number(env.MAIL_TEMPLATES_CACHE_TTL);
  return Number.isFinite(value) && value >= 0 ? value : 300;
}

/** The files of a template in a locale, falling back to English file by file set; null when incomplete. */
async function loadFiles(read: TemplateReader, id: MailTemplateId, locale: MailLocale): Promise<{ files: TemplateFiles; locale: MailLocale } | null> {
  for (const candidate of locale === DEFAULT_MAIL_LOCALE ? [locale] : [locale, DEFAULT_MAIL_LOCALE]) {
    const paths = templatePaths(id, candidate);
    const entries = await Promise.all(Object.entries(paths).map(async ([k, p]) => [k, await read(p)] as const));
    if (entries.every(([, v]) => typeof v === "string")) return { files: Object.fromEntries(entries) as unknown as TemplateFiles, locale: candidate };
  }
  return null;
}

export interface RenderOptions {
  locale?: MailLocale;
  appUrl: string;
  env?: NodeJS.ProcessEnv;
  /** Overrides the readers (tests). */
  local?: TemplateReader;
  remote?: TemplateReader;
  now?: Date;
}

/**
 * Renders a template from the configured source. Bunny problems (unconfigured, unreachable, missing or invalid
 * template) are logged and the bundled template is used instead; a bundled template that fails throws.
 */
export async function renderMailTemplate<Id extends MailTemplateId>(id: Id, vars: MailVars<Id>, options: RenderOptions): Promise<RenderedMail & { locale: MailLocale; source: MailTemplatesSource }> {
  const env = options.env ?? process.env;
  const locale = options.locale && (MAIL_LOCALES as readonly string[]).includes(options.locale) ? options.locale : DEFAULT_MAIL_LOCALE;
  const values = vars as unknown as Values;
  if (mailTemplatesSource(env) === "bunny") {
    try {
      const remote = options.remote ?? (env.BUNNY_STORAGE_API_KEY ? bunnyReader({ env }) : null);
      if (!remote) throw new Error("BUNNY_STORAGE_API_KEY is not set");
      const loaded = await loadFiles(remote, id, locale);
      if (loaded) return { ...renderFiles(id, loaded.locale, loaded.files, values, options.appUrl, options.now), locale: loaded.locale, source: "bunny" };
      console.warn(`mail templates: ${id} (${locale}) not found on Bunny Storage, using the bundled template`);
    } catch (error) {
      console.warn(`mail templates: ${id} (${locale}) unavailable from Bunny Storage, using the bundled template —`, error instanceof Error ? error.message : error);
    }
  }
  const loaded = await loadFiles(options.local ?? localReader(localTemplatesDir(env)), id, locale);
  if (!loaded) throw new MailTemplateError(`${id}: no bundled template (${locale} or ${DEFAULT_MAIL_LOCALE}) in ${localTemplatesDir(env)}`);
  return { ...renderFiles(id, loaded.locale, loaded.files, values, options.appUrl, options.now), locale: loaded.locale, source: "local" };
}
