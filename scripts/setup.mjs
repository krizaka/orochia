#!/usr/bin/env node
/**
 * One-command local setup: `npm run setup`.
 *   1. checks Node ≥ 20 and Docker
 *   2. creates .env from .env.example with a fresh SESSION_SECRET (an existing .env is kept)
 *   3. starts PostgreSQL 16 + Redis 7 (deploy/docker/docker-compose.dev.yml) and waits for them
 *   4. installs dependencies if needed, applies migrations, seeds the development data
 * Safe to run again at any time: every step is idempotent.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ROOT, COMPOSE, c, ok, run, step, warn, fail, waitForPostgres, waitForPort, isLocalDatabase, databaseUrl } from "./lib.mjs";

step("Prerequisites");
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) fail(`Node ${process.versions.node} — Orochia needs Node 20 or later`);
ok(`Node ${process.versions.node}`);
if (run("docker", ["info"], { allowFail: true, quiet: true }).status !== 0) fail("Docker is not running — start Docker Desktop (or the daemon) and retry");
ok("Docker is running");

step("Environment (.env)");
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  ok(".env already exists — kept as is");
} else {
  const example = fs.readFileSync(path.join(ROOT, ".env.example"), "utf8");
  fs.writeFileSync(envFile, example.replace(/^SESSION_SECRET=\s*$/m, `SESSION_SECRET=${crypto.randomBytes(32).toString("hex")}`));
  ok(".env created from .env.example with a generated SESSION_SECRET");
}
if (!isLocalDatabase()) fail(`DATABASE_URL points at ${new URL(databaseUrl()).hostname}: setup only provisions a local database`);

step("PostgreSQL 16 + Redis 7");
run("docker", [...COMPOSE, "up", "-d", "--wait"], { allowFail: true }).status === 0 || run("docker", [...COMPOSE, "up", "-d"]);
await waitForPostgres();
await waitForPort(6379).then(() => ok("Redis is ready")).catch(() => warn("Redis is not reachable — rate limits fall back to memory"));
ok("PostgreSQL is ready on localhost:5432");

step("Dependencies");
if (fs.existsSync(path.join(ROOT, "node_modules"))) ok("node_modules present (run `npm install` after pulling)");
else run("npm", ["install", "--no-audit", "--no-fund"]);

step("Database schema");
run("npm", ["run", "db:migrate", "--silent"]);
ok("Migrations applied");

step("Development data");
run("npm", ["run", "db:seed", "--silent"]);

console.log(`\n${c.green(c.bold("Ready."))} Start the app with ${c.bold("npm run dev")} → http://localhost:3000`);
console.log(c.dim("Database: npm run db:status · db:studio · db:psql · db:reset — see docs/DEVELOPMENT.md"));
