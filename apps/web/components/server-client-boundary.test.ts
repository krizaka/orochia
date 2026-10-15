import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Hotfix: `defaultAvatarUrl` lives in the "use client" module @krizaka/ui/avatar; calling it from a Server Component
// throws "Attempted to call defaultAvatarUrl() from the server" and the page answers 500.
const root = join(__dirname, "..");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (["node_modules", ".next"].includes(name)) return [];
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });

describe("server code never calls a function of a client-only @krizaka/ui module", () => {
  it("does not import defaultAvatarUrl / defaultAvatarSvg from @krizaka/ui/avatar in a file without 'use client'", () => {
    for (const f of [...sources(join(root, "app")), ...sources(join(root, "components")), ...sources(join(root, "lib"))]) {
      const src = readFileSync(f, "utf8");
      if (/^\s*["']use client["']/m.test(src.slice(0, 400))) continue;
      const imports = src.match(/import\s*\{[^}]*\}\s*from\s*["']@krizaka\/ui\/avatar["']/g) ?? [];
      for (const i of imports) expect(i, f).not.toMatch(/defaultAvatar(Url|Svg)/);
    }
  });
});
