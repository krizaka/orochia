import fs from "fs";
import path from "path";

import {
  BUNNY_TEMPLATES_PREFIX,
  localReader,
  MAIL_LOCALES,
  MAIL_TEMPLATES,
  type MailLocale,
  type MailTemplateId,
  mailTemplateIds,
  type MailVars,
  type RenderedMail,
  renderMailTemplate,
} from "./mail-templates";

/**
 * Tooling behind `npm run mail:templates:push` and `mail:templates:preview` (apps/web/scripts/mail-templates.ts):
 * check every template of the repository, render previews, and publish the tree to Bunny Storage.
 */

/** The files of the tree that are published (`preview.json` stays in the repository). */
export function listTemplateFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (sub: string) => {
    for (const entry of fs.readdirSync(path.join(dir, sub), { withFileTypes: true })) {
      const rel = sub ? `${sub}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(rel);
      else if (/\.(html|txt)$/.test(entry.name)) out.push(rel);
    }
  };
  walk("");
  return out.sort();
}

/** The sample variables of a template (`<id>/preview.json`). */
export function previewVars<Id extends MailTemplateId>(dir: string, id: Id): MailVars<Id> {
  return JSON.parse(fs.readFileSync(path.join(dir, id, "preview.json"), "utf8")) as MailVars<Id>;
}

/** Renders every template in every locale from the repository's files; lists the problems instead of throwing. */
export async function renderAll(dir: string, appUrl = "https://orochia.com"): Promise<{ rendered: { id: MailTemplateId; locale: MailLocale; mail: RenderedMail }[]; problems: string[] }> {
  const rendered: { id: MailTemplateId; locale: MailLocale; mail: RenderedMail }[] = [];
  const problems: string[] = [];
  const env = { MAIL_TEMPLATES_SOURCE: "local", MAIL_TEMPLATES_DIR: dir } as unknown as NodeJS.ProcessEnv;
  for (const id of mailTemplateIds()) {
    let vars: Record<string, unknown>;
    try {
      vars = previewVars(dir, id);
    } catch (error) {
      problems.push(`${id}/preview.json: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    const extra = Object.keys(vars).filter((k) => !(k in MAIL_TEMPLATES[id]));
    if (extra.length) problems.push(`${id}/preview.json: unknown variables ${extra.join(", ")}`);
    for (const locale of MAIL_LOCALES) {
      if (!fs.existsSync(path.join(dir, id, locale))) {
        problems.push(`${id}/${locale}: missing (English would be sent)`);
        continue;
      }
      try {
        const mail = await renderMailTemplate(id, vars as MailVars<typeof id>, { locale, appUrl, env, local: localReader(dir), now: new Date("2026-01-01T00:00:00Z") });
        if (mail.locale !== locale) problems.push(`${id}/${locale}: incomplete, English was used`);
        else rendered.push({ id, locale, mail });
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  return { rendered, problems };
}

/** Writes `<out>/<id>.<locale>.html|.txt` and an index page linking them; returns the index path. */
export async function writePreviews(dir: string, out: string): Promise<{ index: string; problems: string[] }> {
  const { rendered, problems } = await renderAll(dir);
  fs.mkdirSync(out, { recursive: true });
  const rows: string[] = [];
  for (const { id, locale, mail } of rendered) {
    fs.writeFileSync(path.join(out, `${id}.${locale}.html`), mail.html);
    fs.writeFileSync(path.join(out, `${id}.${locale}.txt`), `Subject: ${mail.subject}\n\n${mail.text}`);
    const subject = mail.subject.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    rows.push(`<tr><td>${id}</td><td>${locale}</td><td><a href="${id}.${locale}.html">${subject}</a></td><td><a href="${id}.${locale}.txt">text</a></td></tr>`);
  }
  const index = `<!DOCTYPE html><meta charset="utf-8"><title>Mail templates</title><body style="font-family:sans-serif;padding:24px"><h1>Mail templates</h1><table cellpadding="6">${rows.join("")}</table>${problems.length ? `<h2>Problems</h2><pre>${problems.join("\n")}</pre>` : ""}</body>`;
  fs.writeFileSync(path.join(out, "index.html"), index);
  return { index: path.join(out, "index.html"), problems };
}

export type PushStatus = "new" | "changed" | "unchanged" | "unknown";
export interface PushEntry {
  path: string;
  key: string;
  status: PushStatus;
}

/**
 * Compares the repository's tree with Bunny: `remote` reads a key (null when absent). Without `remote` (no
 * credentials) every file is `unknown`. The repository is the reference: files only on Bunny are left alone.
 */
export async function planPush(dir: string, remote: ((key: string) => Promise<string | null>) | null): Promise<PushEntry[]> {
  const entries: PushEntry[] = [];
  for (const rel of listTemplateFiles(dir)) {
    const key = `${BUNNY_TEMPLATES_PREFIX}/${rel}`;
    if (!remote) {
      entries.push({ path: rel, key, status: "unknown" });
      continue;
    }
    const current = await remote(key);
    const local = fs.readFileSync(path.join(dir, rel), "utf8");
    entries.push({ path: rel, key, status: current === null ? "new" : current === local ? "unchanged" : "changed" });
  }
  return entries;
}

/** Writes the entries that differ (new, changed, or unknown) with `put`; returns the keys written. */
export async function applyPush(dir: string, plan: PushEntry[], put: (key: string, body: string) => Promise<void>): Promise<string[]> {
  const written: string[] = [];
  for (const entry of plan) {
    if (entry.status === "unchanged") continue;
    await put(entry.key, fs.readFileSync(path.join(dir, entry.path), "utf8"));
    written.push(entry.key);
  }
  return written;
}
