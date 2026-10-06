import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./crypto";

describe("password hashing", () => {
  it("verifies the password it hashed and nothing else", () => {
    const hash = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", hash)).toBe(true);
    expect(verifyPassword("correct horse batteri", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("salts every hash", () => {
    expect(hashPassword("same")).not.toBe(hashPassword("same"));
  });

  it("has no fallback for foreign hash formats (no shared demo password)", () => {
    const bcryptLike = "$2b$10$abcdefghijklmnopqrstuuWzN5j0q1yGx1Q8pJ3m6t2Yc0uX2Z9e";
    for (const password of ["admin1234", "elena1234", "demo1234", "patron1234"]) {
      expect(verifyPassword(password, bcryptLike)).toBe(false);
    }
    expect(verifyPassword("x", "not-a-hash")).toBe(false);
    expect(verifyPassword("x", "salt:zz")).toBe(false);
  });
});
