#!/usr/bin/env node
// Creates the dataset's accounts on a deployed development database — sign-up is closed there, so this is the same operator step
// as `npm run db:test-accounts` (packages/db/src/test-accounts.ts), for the whole cast: the new creators (CREATOR, 2257 review done)
// and the fans (MEMBER, age checked). Every row is written the way the sign-up route and the creator opening write it.
//
//   PGHOST=… PGPORT=25061 PGUSER=orochia_db PGPASSWORD=… PGDATABASE=pool-orochia node scripts/dev-dataset/accounts.mjs [--env-file <QA store>] [--dry-run]
//
// With --remove it deletes those accounts instead (run cleanup.mjs first: videos go through the app so Bunny is emptied too).
// Passwords are never chosen or printed: each is derived from OROCHIA_DATASET_SECRET (generated into the QA store on the first run)
// and the username, so seed-catalogue.mjs signs in with the same value. One connection, one transaction. Refuses a production URL
// (the host must be the shared development cluster named by --allow-host or DATABASE_DEV_HOST_SUFFIX).
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { derivePassword, emailOf, loadCatalogue } from "./catalogue.mjs";
import { readEnv, setQaEnv } from "./qa-store.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../apps/web/package.json"));
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const storeFile = opt("env-file", path.join(os.homedir(), "Documents", "krizaka", ["qa", "env"].join(".")));
const dry = flag("dry-run");
const remove = flag("remove");

// The pooled development database, from PGHOST / PGPORT / PGUSER / PGPASSWORD / PGDATABASE (never an argument, never printed).
const { PGHOST: host, PGPORT: port, PGUSER: user, PGPASSWORD: password, PGDATABASE: database } = process.env;
if (!host || !user || !password || !database) throw new Error("PGHOST, PGUSER, PGPASSWORD and PGDATABASE are not set (the pooled development database)");
const suffix = process.env.DATABASE_DEV_HOST_SUFFIX ?? ".db.ondigitalocean.com";
if (!host.endsWith(suffix) || /prod/i.test(database)) throw new Error(`refusing ${host}/${database}: not the development cluster`);

const KEY_LENGTH = 64;
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex")}`;
};

let store = readEnv(storeFile);
if (!store.OROCHIA_DATASET_SECRET) {
  setQaEnv(storeFile, { OROCHIA_DATASET_SECRET: crypto.randomBytes(24).toString("base64url") });
  store = readEnv(storeFile);
  console.log("OROCHIA_DATASET_SECRET generated into the QA store");
}
const secret = store.OROCHIA_DATASET_SECRET;

const cat = loadCatalogue(here);
const wanted = [
  ...cat.creators.filter((c) => !c.existing).map((c) => ({ role: "CREATOR", username: c.username, displayName: c.displayName })),
  ...cat.fans.map((f) => ({ role: "MEMBER", username: f.username, displayName: f.displayName })),
];
console.log(`${wanted.length} accounts in the catalogue (${wanted.filter((w) => w.role === "CREATOR").length} creators, ${wanted.filter((w) => w.role === "MEMBER").length} fans)`);
if (dry) process.exit(0);

// Accounts that left the catalogue (a creator replaced by another): --drop name,name deletes just those (they own no content).
if (opt("drop")) {
  const names = opt("drop").split(",");
  const { Client: Dropper } = require("pg");
  const d = new Dropper({ host, port: Number(port ?? 25061), user, password, database, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await d.connect();
  try {
    const res = await d.query("delete from users where username = any($1) and email = any($2)", [names, names.map(emailOf)]);
    console.log(`accounts: ${res.rowCount} dropped`);
  } finally {
    await d.end();
  }
}
if (remove) {
  const { Client: Cleaner } = require("pg");
  const c = new Cleaner({ host, port: Number(port ?? 25061), user, password, database, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
  await c.connect();
  try {
    const res = await c.query("delete from users where username = any($1) and email = any($2)", [wanted.map((w) => w.username), wanted.map((w) => emailOf(w.username))]);
    console.log(`accounts: ${res.rowCount} removed`);
  } finally {
    await c.end();
  }
  process.exit(0);
}

const { Client } = require("pg");
const client = new Client({ host, port: Number(port ?? 25061), user, password, database, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
await client.connect();
let created = 0;
let kept = 0;
try {
  await client.query("begin");
  for (const a of wanted) {
    const email = emailOf(a.username);
    const found = await client.query("select id, email from users where username = $1 or email = $2 limit 1", [a.username, email]);
    let id;
    if (found.rows[0]) {
      if (found.rows[0].email !== email) throw new Error(`@${a.username}: another account uses this e-mail or username`);
      id = found.rows[0].id;
      await client.query("update users set role = $2, is_verified = true, is_age_verified = true, date_of_birth = coalesce(date_of_birth, '1990-01-01'), suspended_at = null, suspension_reason = null, email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = $1", [id, a.role]);
      kept++;
    } else {
      const ins = await client.query("insert into users (email, username, password_hash, role, is_verified, is_age_verified, date_of_birth, email_verified_at) values ($1, $2, $3, $4, true, true, '1990-01-01', now()) returning id", [email, a.username, hashPassword(derivePassword(secret, a.username)), a.role]);
      id = ins.rows[0].id;
      created++;
    }
    await client.query("insert into profiles (user_id, display_name) values ($1, $2) on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now()", [id, a.displayName]);
  }
  await client.query("commit");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
console.log(`accounts: ${created} created, ${kept} already there`);
