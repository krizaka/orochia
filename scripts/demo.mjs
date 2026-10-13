#!/usr/bin/env node
/**
 * The official demo of Orochia — Elena Marlow (a creator) and Alex Carter (a fan), scripts/demo/cast.json.
 *
 *   npm run demo:seed     rebuilds the dedicated demo database from scratch and seeds the demo (replayable)
 *   npm run demo:start    a production build of the app on that database, on :3100, ready for `npm run record:tour`
 *                         (run `npm run build` first)
 *
 * The demo lives in its own database, `orochia_demo` on the dev container (DATABASE_DEMO_URL to choose another
 * local one whose name contains "demo"): the shared development database is never touched. Both commands refuse
 * NODE_ENV=production and any database that is not on this machine. The server never sends mail or push (their
 * keys are blanked, PUSH_DELIVERY=off), keeps test top-ups (APP_SEARCH_INDEXING=off) and seals payout accounts with a
 * local key shared with the seed.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, c, ok, run, step, fail, databaseUrl, isLocalDatabase } from "./lib.mjs";

const [command] = process.argv.slice(2);
const CONTAINER = "orochia-postgres-dev";
const PORT = process.env.APP_DEMO_PORT || "3100";

function demoUrl() {
  if (process.env.DATABASE_DEMO_URL) return process.env.DATABASE_DEMO_URL;
  const url = new URL(databaseUrl());
  url.pathname = "/orochia_demo";
  return url.toString();
}

const url = demoUrl();
const name = new URL(url).pathname.slice(1);
if (process.env.NODE_ENV === "production") fail("Refusing the demo: NODE_ENV=production");
if (!isLocalDatabase(url)) fail(`Refusing the demo: ${new URL(url).hostname} is not this machine`);
if (!/demo/.test(name)) fail(`Refusing the demo: the database "${name}" is not a demo database (its name must contain "demo")`);

/** The demo's environment: the dedicated database, nothing that leaves the machine. */
const env = {
  DATABASE_URL: url,
  PAYMENTS_PAYOUT_ENCRYPTION_KEY: process.env.PAYMENTS_PAYOUT_ENCRYPTION_KEY || "orochia-demo-local-payout-key-never-in-production",
  PAYMENTS_CREDITS_MODE: "test",
  APP_SEARCH_INDEXING: "off",
  PUSH_DELIVERY: "off",
  MAIL_DELIVERY: "off",
  MAIL_API_KEY: "",
  NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
  PORT,
};

switch (command) {
  case "seed": {
    const psql = (db, query) => run("docker", ["exec", "-i", CONTAINER, "psql", "-U", "orochia_user", "-d", db, "-v", "ON_ERROR_STOP=1", "-Atc", query], { quiet: true });
    if (run("docker", ["inspect", CONTAINER], { allowFail: true, quiet: true }).status !== 0) fail("The dev database container is not running — `npm run db:up` first");
    step(`Demo database (${name})`);
    if (psql("postgres", `select 1 from pg_database where datname = '${name}'`).stdout.trim() !== "1") {
      psql("postgres", `create database ${name}`);
      ok("Created");
    }
    psql(name, "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
    ok("Emptied — the demo is rebuilt from scratch every time");
    step("Posters");
    // 16:9 posters of the vertical showcase clips (the clip over its own blurred frame), written where the app keeps
    // local uploads (public/uploads, git-ignored): generated here, never committed. A first `npm run build` or a
    // restart of the server after the first seed serves them.
    const cast = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/demo/cast.json"), "utf8"));
    const posters = path.join(ROOT, "apps/web/public/uploads/demo");
    fs.mkdirSync(posters, { recursive: true });
    if (run("ffmpeg", ["-version"], { allowFail: true, quiet: true }).status !== 0) fail("ffmpeg is missing (brew install ffmpeg)");
    for (const v of cast.videos) {
      run("ffmpeg", ["-y", "-loglevel", "error", "-ss", "2", "-i", path.join(ROOT, "apps/web/public/showcase", `${v.clip}.mp4`), "-frames:v", "1",
        "-filter_complex", "[0]split[a][b];[a]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,boxblur=28:2,eq=brightness=-0.12[bg];[b]scale=-2:720[fg];[bg][fg]overlay=(W-w)/2:0",
        "-q:v", "3", path.join(posters, `${v.key}.jpg`)], { quiet: true });
    }
    ok(`${cast.videos.length} posters in apps/web/public/uploads/demo`);
    step("Migrations");
    run("npm", ["run", "db:migrate", "--silent"], { env, quiet: true });
    ok("Applied");
    step("Elena, Alex and the people around them");
    run("npx", ["tsx", "apps/web/scripts/demo-seed.ts"], { env: { ...env, APP_DEMO_SEED: "1" } });
    console.log(`\n  Next: ${c.bold("npm run build && npm run demo:start")}, then ${c.bold("npm run record:tour")}`);
    break;
  }
  case "start": {
    console.log(`  Orochia (demo database ${name}) on http://localhost:${PORT}`);
    const child = spawn("npx", ["next", "start", "apps/web", "-p", PORT], { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
    child.on("exit", (code) => process.exit(code ?? 0));
    break;
  }
  default:
    console.log("Usage: npm run demo:seed | demo:start");
    process.exit(command ? 1 : 0);
}
