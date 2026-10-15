#!/usr/bin/env node
/**
 * Records a real run of the Explorer on Orazaka: `apps/web/lib/explorer-run.json`, the file krizaka.com's table "What each
 * product runs on" reads to say "Yes" — never typed, never a guess. The run id is one Orochia's operator console showed (the
 * `ai_runs` row of an indexing or a search); this script checks it against Orazaka's own logs — the core logs one line per
 * call, `embedding.run runId=… user=… model=… inputs=… dimensions=… promptTokens=…` — and writes what that line says.
 *
 *   node scripts/record-explorer-run.mjs --run-id <uuid> [--app orazaka-dev]     (needs doctl, signed in)
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The fields of an Orazaka `embedding.run` log line for `runId`, or null when the line is not that run's. */
export function parseRunLine(line, runId) {
  const message = /embedding\.run (.*)$/m.exec(line.replace(/\\"/g, '"'))?.[1] ?? "";
  const fields = Object.fromEntries([...message.matchAll(/(\w+)=([^\s"]+)/g)].map((m) => [m[1], m[2]]));
  if (fields.runId !== runId || !fields.model) return null;
  const at = /"@timestamp":"([^"]+)"/.exec(line)?.[1] ?? null;
  return {
    runId,
    model: fields.model,
    inputs: Number(fields.inputs),
    dimensions: Number(fields.dimensions),
    promptTokens: Number(fields.promptTokens ?? 0),
    loggedAt: at,
  };
}

function flag(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runId = flag("--run-id");
  if (!runId || !UUID.test(runId)) throw new Error("usage: record-explorer-run.mjs --run-id <uuid> [--app orazaka-dev]");
  const name = flag("--app") ?? "orazaka-dev";
  const doctl = (args) => execFileSync("doctl", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const app = JSON.parse(doctl(["apps", "list", "-o", "json"])).find((a) => a.spec?.name === name);
  if (!app) throw new Error(`no app ${name}`);
  const logs = doctl(["apps", "logs", app.id, "core", "--type", "run", "--tail", "20000"]);
  const found = logs.split("\n").map((l) => parseRunLine(l, runId)).find(Boolean);
  if (!found) throw new Error(`Orazaka's logs hold no embedding.run for ${runId} (the logs are short: record a recent run)`);
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "apps", "web", "lib", "explorer-run.json");
  writeFileSync(file, `${JSON.stringify({ ...found, source: "Orazaka dev: the embedding.run line of the core's logs" }, null, 2)}\n`);
  process.stderr.write(`recorded ${runId} (${found.model}, ${found.inputs} texts) in apps/web/lib/explorer-run.json\n`);
}
