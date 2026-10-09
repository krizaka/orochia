/**
 * npm run mail:templates:preview [-- --out <dir>]   renders every template and locale to apps/web/.mail-preview/
 * npm run mail:templates:push [-- --apply]          compares the repository's templates with Bunny Storage
 *                                                   (`mail-templates/` in BUNNY_STORAGE_ZONE); --apply writes them
 *
 * The repository is the reference: push checks every template first and refuses to publish a broken one. Without
 * --apply nothing is written (dry run). Reads the root .env; real environment variables win.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { localTemplatesDir } from "../lib/mail-templates";
import { applyPush, planPush, renderAll, writePreviews } from "../lib/mail-templates-tools";
import { bunnyStorageCredentials, getBunnyConfigObject, putBunnyConfigObject } from "../lib/storage";

const rootEnv = path.resolve(__dirname, "..", "..", "..", ".env");
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

async function main(): Promise<number> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { apply: { type: "boolean", default: false }, out: { type: "string" } },
  });
  const dir = path.resolve(__dirname, "..", "mail-templates");
  process.env.MAIL_TEMPLATES_DIR ??= dir;
  const command = positionals[0];

  if (command === "preview") {
    const out = path.resolve(values.out ?? path.join(__dirname, "..", ".mail-preview"));
    const { index, problems } = await writePreviews(localTemplatesDir(), out);
    for (const problem of problems) console.error(`✗ ${problem}`);
    console.log(`✓ Previews written — open ${index}`);
    return problems.length ? 1 : 0;
  }

  if (command === "push") {
    const { problems } = await renderAll(dir);
    if (problems.length) {
      for (const problem of problems) console.error(`✗ ${problem}`);
      console.error("✗ Fix the templates before publishing them.");
      return 1;
    }
    const bunny = bunnyStorageCredentials();
    if (!bunny && values.apply) {
      console.error("✗ BUNNY_STORAGE_API_KEY (and BUNNY_STORAGE_ZONE, BUNNY_STORAGE_ENDPOINT) are required to publish.");
      return 1;
    }
    const plan = await planPush(dir, bunny ? (key) => getBunnyConfigObject(key, { timeoutMs: 15_000 }) : null);
    const zone = process.env.BUNNY_STORAGE_ZONE || "orochia-media";
    console.log(bunny ? `Bunny Storage zone ${zone}, prefix mail-templates/:` : "No Bunny credentials: showing what would be published.");
    for (const entry of plan) console.log(`  ${entry.status.padEnd(9)} ${entry.key}`);
    const pending = plan.filter((e) => e.status !== "unchanged").length;
    if (!values.apply) {
      console.log(`Dry run: ${pending} file(s) to publish. Run again with --apply to write them.`);
      return 0;
    }
    const written = await applyPush(dir, plan, (key, body) => putBunnyConfigObject(key, body));
    console.log(`✓ ${written.length} file(s) published. Running instances pick them up within MAIL_TEMPLATES_CACHE_TTL.`);
    return 0;
  }

  console.error("Usage: mail-templates.ts preview [--out <dir>] | push [--apply]");
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error("✗", error instanceof Error ? error.message : error);
    process.exit(1);
  });
