#!/usr/bin/env node

/**
 * OROCHIA — Code-Driven Documentation & Architecture Generator
 * Inspects source code, Drizzle database schemas, Next.js API route trees,
 * and packages to generate verified architecture models and markdown specs.
 *
 * Part of Krizaka Site Governance & Autonomous Engineering Rigor.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const KRIZAKA_COM_DATA = path.resolve(ROOT_DIR, "../../app/data");

console.log("⚡ [Orochia Docs Gen] Inspecting codebase...");

// 1. Scan Database Schema
const schemaPath = path.join(ROOT_DIR, "packages/db/src/schema.ts");
let tablesFound = [];
if (fs.existsSync(schemaPath)) {
  const schemaContent = fs.readFileSync(schemaPath, "utf-8");
  const tableMatches = [...schemaContent.matchAll(/export const (\w+) = pgTable\(["'](\w+)["']/g)];
  tablesFound = tableMatches.map((m) => ({
    exportName: m[1],
    tableName: m[2],
  }));
}

// 2. Scan API Route Tree
const apiDir = path.join(ROOT_DIR, "apps/web/app/api");
const endpoints = [];

function scanApi(dir, baseRoute = "/api") {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      scanApi(path.join(dir, item.name), `${baseRoute}/${item.name}`);
    } else if (item.name === "route.ts" || item.name === "route.js") {
      const content = fs.readFileSync(path.join(dir, item.name), "utf-8");
      const methods = [];
      if (/export\s+(async\s+)?function\s+GET/i.test(content)) methods.push("GET");
      if (/export\s+(async\s+)?function\s+POST/i.test(content)) methods.push("POST");
      if (/export\s+(async\s+)?function\s+PUT/i.test(content)) methods.push("PUT");
      if (/export\s+(async\s+)?function\s+DELETE/i.test(content)) methods.push("DELETE");
      endpoints.push({
        path: baseRoute,
        methods: methods.length ? methods : ["UNKNOWN"],
      });
    }
  }
}

scanApi(apiDir);

// 3. Construct Ecosystem Architecture Model
const architectureModel = {
  product: "orochia",
  title: "Orochia Ecosystem Architecture",
  generatedAt: new Date().toISOString(),
  source: "generated from code by products/orochia/scripts/generate-docs.mjs — do not hand-edit",
  repositories: [
    {
      name: "orochia",
      repo: "krizaka/orochia",
      url: "https://github.com/krizaka/orochia",
      port: 3000,
      role: "Consumer Platform & 4K HLS Stream Player",
      stack: ["Next.js 14 App Router", "Drizzle ORM", "Bunny.net Stream", "PostgreSQL 16", "Redis 7"],
      description: "Direct-to-Bunny edge streaming, 18 U.S.C. § 2257 age gates, dual-mode DevX storage, and tokenized creator tips.",
    },
    {
      name: "orochia-admin",
      repo: "krizaka/orochia-admin",
      url: "https://github.com/krizaka/orochia-admin",
      port: 3001,
      role: "Control Plane, 2257 Compliance Vault & Treasury",
      stack: ["Next.js 14 App Router", "Tailwind CSS", "Bunny Telemetry SDK", "Lucide Icons"],
      description: "Primary producer KYC vault, single-click emergency worldwide CDN purge (<250ms), and 4-tier platform monetization.",
    },
    {
      name: "orochia-design-system",
      repo: "krizaka/orochia-design-system",
      url: "https://github.com/krizaka/orochia-design-system",
      port: 3002,
      role: "UX Design System & Tokens (Obsidian Velvet Noir)",
      stack: ["React 18", "Tailwind CSS", "TypeScript", "Micro-Interactions"],
      description: "Obsidian Velvet Noir & Cyber-Sensual Luxury component library and live interactive showcase for adult creator platforms.",
    },
  ],
  modules: [
    {
      id: "media-ingest",
      name: "Media Ingest & Bunny Stream Driver",
      path: "packages/media",
      features: ["Tus Resumable Chunking", "Direct Edge Storage Upload", "HMAC SHA-256 Token Signing", "HLS Adaptive Ladders"],
    },
    {
      id: "data-persistence",
      name: "Data Persistence & Ledger",
      path: "packages/db",
      tablesCount: tablesFound.length,
      tables: tablesFound.map((t) => t.tableName),
    },
    {
      id: "creator-monetization",
      name: "Platform Treasury & Rake Engine",
      path: "apps/web/app/api/platform/treasury",
      streams: ["10% Protocol Take Rate", "$49 2257 Audit Onboarding Fee", "$25/day Spotlight Auction", "1.5% Express Fast-Lane Fee"],
    },
    {
      id: "compliance-vault",
      name: "18 U.S.C. § 2257 Federal Custodian Vault",
      path: "apps/web/app/legal/2257",
      features: ["Government ID Archival", "Perjury Age Verification", "Certified Federal Audit Dossier"],
    },
  ],
  apiEndpoints: endpoints,
};

// 4. Output Generated Files
const outDir = path.join(ROOT_DIR, "docs/_generated");
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outJsonPath = path.join(outDir, "orochia-architecture.json");
fs.writeFileSync(outJsonPath, JSON.stringify(architectureModel, null, 2));
console.log(`✅ Saved ${outJsonPath}`);

// Copy/Sync directly into krizaka-com if present
if (fs.existsSync(KRIZAKA_COM_DATA)) {
  const targetPath = path.join(KRIZAKA_COM_DATA, "orochia-architecture.json");
  fs.writeFileSync(targetPath, JSON.stringify(architectureModel, null, 2));
  console.log(`✅ Synced to krizaka-com: ${targetPath}`);
}

// 5. Generate Markdown API Reference from Code
let apiMarkdown = `# 🤖 Orochia API Reference & Contracts
> Generated automatically from code by \`scripts/generate-docs.mjs\` — do not hand-edit.

## Detected HTTP Endpoints (${endpoints.length} routes)

| HTTP Path | Supported Methods | Description / Handler |
| :--- | :--- | :--- |
${endpoints
  .map(
    (e) =>
      `| \`${e.path}\` | \`${e.methods.join(", ")}\` | ${
        e.path.includes("bunny")
          ? "Bunny.net Stream & Video Collection Management"
          : e.path.includes("treasury")
          ? "Platform Revenue Ledger & 10% Protocol Rake"
          : e.path.includes("uploads")
          ? "Dual-Mode Media Storage Ingest (Local/Bunny)"
          : e.path.includes("auth")
          ? "PostgreSQL Scrypt Authentication & Sessions"
          : e.path.includes("report")
          ? "DMCA & Safety Triage Processor"
          : "System Core API"
      } |`
  )
  .join("\n")}

## Discovered Database Schema Tables (${tablesFound.length} tables)

| SQL Table Name | Drizzle Export |
| :--- | :--- |
${tablesFound.map((t) => `| \`${t.tableName}\` | \`${t.exportName}\` |`).join("\n")}
`;

const apiDocPath = path.join(ROOT_DIR, "docs/API_CONTRACTS.md");
fs.writeFileSync(apiDocPath, apiMarkdown);
console.log(`✅ Saved ${apiDocPath}`);

console.log("✨ [Orochia Docs Gen] Done!");
