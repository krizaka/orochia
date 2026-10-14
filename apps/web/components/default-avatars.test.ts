import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const sources = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (["node_modules", ".next"].includes(name)) return [];
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [p] : [];
  });

describe("profiles without a photo", () => {
  const files = [...sources(join(root, "app")), ...sources(join(root, "components")), ...sources(join(root, "lib"))];

  it("show the Krizaka default avatar of Orochia, never a local placeholder image", () => {
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/avatar-placeholder|AVATAR_PLACEHOLDER/);
  });

  it("give every Avatar fed by a profile photo a defaultAvatar of the orochia brand", () => {
    for (const f of files) {
      for (const tag of readFileSync(f, "utf8").match(/<Avatar\b[^>]*?src=\{[^}]*(?:avatar|Avatar)[^}]*\}[^>]*?\/?>/g) ?? []) {
        if (tag.includes("actorAvatar") || tag.includes("pending.avatarUrl")) continue; // a photo that exists, or the sign-up preview
        expect(tag, f).toContain('defaultAvatar={{ brand: "orochia"');
      }
    }
  });
});
