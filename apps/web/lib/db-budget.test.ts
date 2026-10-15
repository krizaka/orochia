import { describe, expect, it } from "vitest";

import { connectionLimit } from "./db-budget";

describe("connectionLimit", () => {
  it("is the role's own limit when it has one", () => {
    expect(connectionLimit(22, 100)).toBe(22);
  });
  it("is the server's when the role has none (-1)", () => {
    expect(connectionLimit(-1, 100)).toBe(100);
  });
  it("never exceeds the server's", () => {
    expect(connectionLimit(500, 100)).toBe(100);
  });
});
