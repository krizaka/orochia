import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { usernameWithSuffix } from "./username-suffix";

const USERNAME = /^[a-z0-9_]{3,30}$/;

describe("usernameWithSuffix", () => {
  it("stays a valid username even from the longest base (26 characters)", () => {
    const name = usernameWithSuffix("a".repeat(26));
    expect(name).toMatch(USERNAME);
    expect(name).toHaveLength(30);
  });

  it("varies from call to call", () => {
    const names = new Set(Array.from({ length: 50 }, () => usernameWithSuffix("oussama")));
    expect(names.size).toBeGreaterThan(40);
  });

  it("usernames.ts takes its suffix from it, not from Math.random", () => {
    const source = readFileSync(new URL("./usernames.ts", import.meta.url), "utf8");
    expect(source).not.toContain("Math.random");
    expect(source).toContain("usernameWithSuffix");
  });
});
