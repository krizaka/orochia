import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

/** Profile pages live at /@username, but the API keeps /api/creators/<username>: a rewrite must never touch API calls. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : /\.(tsx?|mjs)$/.test(name) ? [full] : [];
  });
}

describe("API paths", () => {
  it("never call /api/@…", () => {
    const root = path.resolve(__dirname, "..");
    const offenders = ["app", "components", "lib"].flatMap((d) => files(path.join(root, d))).filter((f) => readFileSync(f, "utf8").includes("/api/@"));
    expect(offenders.filter((f) => !f.endsWith("routes.test.ts"))).toEqual([]);
  });
});
