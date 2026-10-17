#!/usr/bin/env node
// Gives the dev creators the @handle the dataset says (a person's, never « qa_… »): there is no API to rename an account
// and sign-up is closed on dev, so this one step writes the dev database directly — `users.username` of the accounts the
// dataset names, found by their e-mail (QA env file, never printed). It refuses anything but the dev database.
//
//   node scripts/dev-dataset/handles.mjs [--dry-run]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/web/package.json"));
const pg = require("pg");
const read = (name) => {
  const env = {};
  for (const line of fs.readFileSync(path.join(os.homedir(), "Documents", "krizaka", [name, "env"].join(".")), "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
};
const qa = read("qa");
const db = read("db");
const dry = process.argv.includes("--dry-run");
const dataset = JSON.parse(fs.readFileSync(path.join(here, "dataset.json"), "utf8"));

// The dev cluster's `orochia_db` — the one database of dev.orochia.com (never production: there is none yet).
const client = new pg.Client({ host: db.DB_HOST, port: Number(db.DB_PORT), user: "orochia_db", password: db.DB_OROCHIA_DB_PASSWORD, database: "orochia_db", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000 });
await client.connect();
try {
  for (const c of dataset.creators) {
    const email = qa[`${c.credentials}_EMAIL`];
    if (!email) throw new Error(`${c.credentials}_EMAIL is missing from the QA credentials`);
    const { rows } = await client.query("select id, username from users where lower(email) = lower($1)", [email]);
    if (rows.length !== 1) throw new Error(`${c.key}: ${rows.length} account(s) for ${c.credentials}`);
    if (rows[0].username === c.username) {
      console.log(`= ${c.displayName}: @${c.username}`);
      continue;
    }
    if (dry) {
      console.log(`~ ${c.displayName}: @${rows[0].username} → @${c.username}`);
      continue;
    }
    await client.query("update users set username = $1, updated_at = now() where id = $2", [c.username, rows[0].id]);
    console.log(`✓ ${c.displayName}: @${rows[0].username} → @${c.username}`);
  }
} finally {
  await client.end();
}
