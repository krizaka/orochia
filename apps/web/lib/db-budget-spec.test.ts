import { describe, expect, it } from "vitest";

/** krizaka-dev-pg has 22 usable connections for every dev service: the dev app's pool stays at 2 (+1 LISTEN). */
describe("dev database connection budget", () => {
  it("the dev app spec caps the pool at 2 connections", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    let dir = process.cwd();
    while (!fs.existsSync(path.join(dir, "deploy/digitalocean/app-spec.dev.yaml"))) {
      const up = path.dirname(dir);
      if (up === dir) throw new Error("repository root not found");
      dir = up;
    }
    const spec = fs.readFileSync(path.join(dir, "deploy/digitalocean/app-spec.dev.yaml"), "utf8");
    const match = spec.match(/key: DATABASE_MAX_CONNECTIONS\s+scope: RUN_TIME\s+value: "(\d+)"/);
    expect(match, "DATABASE_MAX_CONNECTIONS is set in the dev spec").not.toBeNull();
    expect(Number(match![1])).toBeLessThanOrEqual(2);
  });
});
