#!/usr/bin/env node
/**
 * Database lifecycle for development — `npm run db:<command>`:
 *   status   migrations applied vs. files, row counts of the main tables
 *   reset    drops the local schema, re-applies every migration, re-seeds (asks for confirmation;
 *            `--yes` skips it). Refuses any non-local DATABASE_URL and NODE_ENV=production.
 *   psql     opens psql in the dev container
 *   dump     writes a SQL dump of the local database to ./backups/
 *   restore  restores a dump: `npm run db:restore -- backups/<file>.sql`
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { ROOT, c, ok, run, step, fail, warn, isLocalDatabase, databaseUrl } from "./lib.mjs";

const [command, ...rest] = process.argv.slice(2);
const CONTAINER = "orochia-postgres-dev";
const PSQL = ["exec", "-i", CONTAINER, "psql", "-U", "orochia_user", "-d", "orochia_db", "-v", "ON_ERROR_STOP=1"];

function guardLocal(action) {
  if (process.env.NODE_ENV === "production") fail(`Refusing to ${action}: NODE_ENV=production`);
  if (!isLocalDatabase()) fail(`Refusing to ${action}: DATABASE_URL is not local (${new URL(databaseUrl()).hostname})`);
  if (run("docker", ["inspect", CONTAINER], { allowFail: true, quiet: true }).status !== 0) {
    fail(`The dev database container is not running — run \`npm run setup\` (or docker compose up) first`);
  }
}

const sqlOut = (query) => run("docker", [...PSQL, "-At", "-c", query], { quiet: true }).stdout.trim();

switch (command) {
  case "status": {
    guardLocal("read the database");
    const files = fs.readdirSync(path.join(ROOT, "packages/db/drizzle")).filter((f) => f.endsWith(".sql")).sort();
    const applied = Number(sqlOut("select count(*) from public.__drizzle_migrations") || 0);
    step("Migrations");
    files.forEach((f, i) => console.log(`  ${i < applied ? c.green("✓") : c.yellow("·")} ${f}`));
    if (applied < files.length) console.log(c.yellow(`  ${files.length - applied} pending — run npm run db:migrate`));
    step("Rows");
    for (const t of ["users", "videos", "follows", "contacts", "playlists", "tips_ledger", "payment_intents", "payout_requests", "compliance_reports"]) {
      console.log(`  ${t.padEnd(20)} ${sqlOut(`select count(*) from ${t}`)}`);
    }
    break;
  }
  case "reset": {
    guardLocal("reset the database");
    if (!rest.includes("--yes")) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(`${c.red("This deletes every row of the local database.")} Type "reset" to continue: `);
      rl.close();
      if (answer.trim() !== "reset") fail("Cancelled");
    }
    step("Dropping the local schema");
    run("docker", [...PSQL, "-c", "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;"], { quiet: true });
    ok("Schema dropped");
    step("Migrations");
    run("npm", ["run", "db:migrate", "--silent"]);
    step("Seed");
    run("npm", ["run", "db:seed", "--silent"]);
    ok("Local database rebuilt from the migrations and the seed");
    break;
  }
  case "psql": {
    guardLocal("open psql");
    run("docker", ["exec", "-it", CONTAINER, "psql", "-U", "orochia_user", "-d", "orochia_db"]);
    break;
  }
  case "dump": {
    guardLocal("dump the database");
    fs.mkdirSync(path.join(ROOT, "backups"), { recursive: true });
    const file = path.join(ROOT, "backups", `orochia-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
    const r = run("docker", ["exec", CONTAINER, "pg_dump", "-U", "orochia_user", "-d", "orochia_db", "--no-owner"], { quiet: true });
    fs.writeFileSync(file, r.stdout);
    ok(`Dump written to ${path.relative(ROOT, file)}`);
    break;
  }
  case "restore": {
    guardLocal("restore the database");
    const file = rest.find((a) => !a.startsWith("--"));
    if (!file || !fs.existsSync(file)) fail("Usage: npm run db:restore -- backups/<file>.sql");
    warn("Restoring over the current local database");
    run("docker", [...PSQL, "-c", "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;"], { quiet: true });
    const restore = spawnSync("docker", PSQL, { input: fs.readFileSync(file), stdio: ["pipe", "inherit", "inherit"] });
    if (restore.status !== 0) fail("Restore failed");
    ok(`Restored ${file}`);
    break;
  }
  default:
    console.log("Usage: npm run db:status | db:reset [-- --yes] | db:psql | db:dump | db:restore -- <file>");
    process.exit(command ? 1 : 0);
}
