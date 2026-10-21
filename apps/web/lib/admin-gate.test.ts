import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Dev preview `admin.gated` (formerly orochia-admin#41): the operator's endpoints are reachable only by an ADMIN (the console's
// service token acts as the owner), never from the public host without it; the console's own pages are not served here.
const api = join(__dirname, "..", "app", "api", "admin");
const routes = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? routes(path) : name === "route.ts" ? [path] : [];
  });

describe("the operator API is gated", () => {
  const files = routes(api);

  it("has the routes the console calls", () => {
    expect(files.length).toBeGreaterThanOrEqual(26);
  });

  it("every handler of every /api/admin route asks for an ADMIN before it does anything", () => {
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const handlers = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].length;
      const guards = [...source.matchAll(/requireUserWithRole\(\["ADMIN"\]\)|requireAdmin\(/g)].length;
      expect(handlers, file).toBeGreaterThan(0);
      expect(guards, `${file}: ${handlers} handler(s), ${guards} admin guard(s)`).toBeGreaterThanOrEqual(handlers);
    }
  });

  it("the console's pages are not part of this app: no /admin page, no console screen here", () => {
    const app = join(__dirname, "..", "app");
    const top = readdirSync(app);
    expect(top).not.toContain("admin");
    expect(readdirSync(join(app, "[locale]"))).not.toContain("admin");
  });
});
