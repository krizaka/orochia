// GitHub Actions minutes guard (krizaka/.github CI-COST): a job without a timeout, a sleep of minutes or a Scorecard on
// every push is refused here, not found on the bill.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "..", "..", "..", ".github", "workflows");

function jobs(text: string): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const at = text.search(/^jobs:\s*$/m);
  if (at < 0) return out;
  for (const line of text.slice(at).split("\n").slice(1)) {
    const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (m) out.push({ name: m[1], text: "" });
    else if (out.length) out[out.length - 1].text += `${line}\n`;
  }
  return out;
}

describe("workflows cost guard", () => {
  for (const file of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
    const text = readFileSync(join(dir, file), "utf8");
    it(`${file}: every runner job has a timeout, no sleep of minutes`, () => {
      for (const job of jobs(text).filter((j) => /^\s{4}runs-on:/m.test(j.text))) {
        expect(job.text, `${file}: ${job.name}`).toMatch(/^\s{4}timeout-minutes:\s*\d+/m);
      }
      // app-links-live retries a live check while the deploy lands (bounded loop, push-filtered): its sleeps are the poll.
      if (file !== "app-links-live.yml") expect(text.replace(/#.*$/gm, "")).not.toMatch(/\bsleep\s+\d{3,}\b/);
    });
    it(`${file}: Scorecard is not run on every push`, () => {
      if (!/^name:\s*Scorecard/m.test(text)) return;
      expect(text.slice(0, text.search(/^jobs:/m))).not.toMatch(/^\s{2}push:/m);
    });
  }
});
