import { describe, expect, it } from "vitest";
import { validateOwner } from "./owner";

const ok = { email: "owner@example.com", username: "owner", name: "Owner" };

describe("validateOwner", () => {
  it("accepts a normal owner", () => {
    expect(validateOwner(ok).email).toBe("owner@example.com");
  });

  it("refuses an address longer than 254 characters before running any pattern", () => {
    expect(() => validateOwner({ ...ok, email: `${"a".repeat(250)}@b.co` })).toThrow("not an e-mail");
    expect(validateOwner({ ...ok, email: `${"a".repeat(240)}@b.co` }).email).toHaveLength(245);
  });
});
