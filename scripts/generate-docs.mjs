#!/usr/bin/env node
/**
 * OROCHIA — code-driven documentation.
 *
 * Reads the Drizzle schema and the Next.js API route tree and writes:
 *   - docs/_generated/orochia-architecture.json   (repositories, modules, tables, endpoints)
 *   - docs/API_CONTRACTS.md                        (endpoint reference with its access rule)
 * and, when this repository is cloned inside krizaka-com (products/orochia), syncs them to the site:
 *   - app/data/orochia-architecture.json
 *   - orochia-content/docs/*.md                    (published through lib/docs-manifest.ts)
 *
 * Deterministic (no timestamps), so `--check` can fail a build when the docs are stale.
 *
 *   node scripts/generate-docs.mjs           generate (+ sync when inside krizaka-com)
 *   node scripts/generate-docs.mjs --check   exit 1 when a generated file is out of date
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.resolve(ROOT, "../..");
const CHECK = process.argv.includes("--check");

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
const walk = (dir, pred) =>
  !fs.existsSync(dir)
    ? []
    : fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        return e.isDirectory() ? walk(p, pred) : pred(p) ? [p] : [];
      });

// ── Database tables (packages/db/src/schema/*.ts) ─────────────────────────────────────────
const tables = walk(path.join(ROOT, "packages/db/src/schema"), (p) => p.endsWith(".ts"))
  .sort()
  .flatMap((file) =>
    [...read(file).matchAll(/export const (\w+) = pgTable\(\s*["'](\w+)["']/g)].map((m) => ({
      table: m[2],
      export: m[1],
      file: path.relative(ROOT, file),
    })),
  );

// ── API endpoints (apps/web/app/api/**/route.ts) ──────────────────────────────────────────
const apiDir = path.join(ROOT, "apps/web/app/api");
function accessOf(src) {
  const roles = src.match(/requireUserWithRole\(\[([^\]]*)\]\)/);
  if (roles) return `session · ${roles[1].replace(/["\s]/g, "").split(",").join(" / ")}`;
  if (/verifyWebhookSignature|verifyBunnyWebhookSignature/.test(src)) return "signed webhook";
  if (/metricsToken\(\)/.test(src)) return "bearer token";
  if (/getCurrentUser\(\)/.test(src)) return "public · session-aware";
  return "public";
}
function summaryOf(src, method) {
  const at = src.search(new RegExp(`export (async )?function ${method}\\b`));
  const before = src.slice(0, at);
  const open = before.lastIndexOf("/**");
  const doc = open < 0 ? null : before.slice(open).match(/^\/\*\*([\s\S]*?)\*\/\s*$/);
  if (!doc) return "";
  return doc[1]
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ")
    .split(/(?<=\.)\s/)[0];
}
const endpoints = walk(apiDir, (p) => /route\.(ts|js)$/.test(p))
  .map((file) => {
    const src = read(file);
    const route = "/api/" + path.relative(apiDir, path.dirname(file)).split(path.sep).join("/");
    const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) =>
      new RegExp(`export (async )?function ${m}\\b`).test(src),
    );
    // The access rule is read from each handler's own body (plus the module's shared helpers).
    const starts = methods.map((m) => ({ m, at: src.search(new RegExp(`export (async )?function ${m}\\b`)) }));
    const prelude = src.slice(0, Math.min(...starts.map((s) => s.at)));
    return starts.map(({ m, at }) => {
      const next = starts.map((s) => s.at).filter((x) => x > at).sort((x, y) => x - y)[0] ?? src.length;
      const body = src.slice(at, next);
      const helpers = /verifyWebhookSignature|metricsToken\(\)/.test(body) ? body : body + prelude.replace(/import[^;]*;/g, "");
      return { method: m, path: route, access: accessOf(helpers), summary: summaryOf(src, m) };
    });
  })
  .flat()
  .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

// ── Model ────────────────────────────────────────────────────────────────────────────────
const feePct = (read(path.join(ROOT, "packages/payments/src/ledger.ts")).match(/\? (\d+) : Number\(raw\)/) ?? [])[1];
const model = {
  product: "orochia",
  title: "Orochia Ecosystem Architecture",
  source: "generated from code by products/orochia/scripts/generate-docs.mjs — do not hand-edit",
  repositories: [
    {
      name: "orochia",
      repo: "krizaka/orochia",
      url: "https://github.com/krizaka/orochia",
      port: 3000,
      role: "Consumer platform, creator studio & 4K HLS player",
      stack: ["Next.js 14 App Router", "Drizzle ORM", "PostgreSQL 16", "Redis 7", "Bunny.net Stream"],
      description:
        "Direct-to-Bunny streaming with short-lived signed URLs, server-side access control, gateway-confirmed unlocks and an idempotent double-entry ledger.",
    },
    {
      name: "orochia-admin",
      repo: "krizaka/orochia-admin",
      url: "https://github.com/krizaka/orochia-admin",
      port: 3001,
      role: "Control plane: 2257 records, moderation & treasury",
      stack: ["Next.js 14 App Router", "Tailwind CSS", "Lucide Icons"],
      description: "Administrative console for performer records, content reports and platform revenue.",
    },
    {
      name: "orochia-design-system",
      repo: "krizaka/orochia-design-system",
      url: "https://github.com/krizaka/orochia-design-system",
      port: 3002,
      role: "Design system & tokens (Obsidian Velvet Noir)",
      stack: ["React 18", "Tailwind CSS", "TypeScript"],
      description: "Component library and tokens shared by the Orochia applications.",
    },
  ],
  modules: [
    {
      id: "media",
      name: "Media ingest & delivery",
      path: "packages/media",
      features: ["Tus resumable upload sessions", "HMAC-signed HLS URLs (300 s)", "Signed Bunny webhooks"],
    },
    {
      id: "payments",
      name: "Payments & ledger",
      path: "packages/payments",
      features: [
        "Payment intents recorded before checkout",
        "CCBill · Segpay · NowPayments · Stripe adapters",
        "Constant-time webhook signatures, no lenient mode",
        "Exactly-once settlement",
        `Platform fee ${feePct ?? "10"}% (PLATFORM_FEE_PERCENTAGE)`,
      ],
    },
    {
      id: "data",
      name: "Data persistence",
      path: "packages/db",
      tablesCount: tables.length,
      tables: tables.map((t) => t.table),
    },
    {
      id: "compliance",
      name: "Compliance",
      path: "apps/web/app/api/legal/report",
      features: ["18+ certification at registration", "Creator verification before upload", "Persisted content reports"],
    },
  ],
  apiEndpoints: endpoints,
};

const apiMarkdown = `---
title: Orochia API Reference
description: Every HTTP endpoint of the Orochia web app, with the access rule that guards it — extracted from the code.
---

# Orochia API Reference

> Generated from code by \`scripts/generate-docs.mjs\` — do not hand-edit.

## Endpoints (${endpoints.length})

| Method | Path | Access | Summary |
| :--- | :--- | :--- | :--- |
${endpoints.map((e) => `| \`${e.method}\` | \`${e.path}\` | ${e.access} | ${e.summary || "—"} |`).join("\n")}

## Database tables (${tables.length})

| Table | Drizzle export | Defined in |
| :--- | :--- | :--- |
${tables.map((t) => `| \`${t.table}\` | \`${t.export}\` | \`${t.file}\` |`).join("\n")}
`;

const outputs = {
  [path.join(ROOT, "docs/_generated/orochia-architecture.json")]: JSON.stringify(model, null, 2) + "\n",
  [path.join(ROOT, "docs/API_CONTRACTS.md")]: apiMarkdown,
};

if (CHECK) {
  const stale = Object.entries(outputs).filter(([p, content]) => read(p) !== content);
  if (stale.length) {
    console.error("✗ docs are stale — run `npm run docs:generate`:");
    for (const [p] of stale) console.error(`  - ${path.relative(ROOT, p)}`);
    process.exit(1);
  }
  console.log(`✓ docs up to date (${endpoints.length} endpoints, ${tables.length} tables).`);
  process.exit(0);
}

for (const [p, content] of Object.entries(outputs)) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
console.log(`✓ docs generated (${endpoints.length} endpoints, ${tables.length} tables).`);

// ── Sync into krizaka-com when cloned at products/orochia ─────────────────────────────────
if (fs.existsSync(path.join(SITE, "app/data")) && fs.existsSync(path.join(SITE, "lib/docs-manifest.ts"))) {
  fs.writeFileSync(path.join(SITE, "app/data/orochia-architecture.json"), outputs[path.join(ROOT, "docs/_generated/orochia-architecture.json")]);
  const dest = path.join(SITE, "orochia-content/docs");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const docs = fs.readdirSync(path.join(ROOT, "docs")).filter((n) => n.endsWith(".md"));
  for (const name of docs) fs.copyFileSync(path.join(ROOT, "docs", name), path.join(dest, name));
  console.log(`✓ synced ${docs.length} docs + architecture to krizaka-com`);
}
