import { describe, expect, it } from "vitest";

import { unlessUnavailable } from "./degrade";

describe("unlessUnavailable", () => {
  it("passes the value through", async () => {
    await expect(unlessUnavailable(async () => [1, 2])).resolves.toEqual({ ok: true, value: [1, 2] });
  });

  it("turns a database that refuses connections into a missing part, even wrapped by Drizzle", async () => {
    const refused = Object.assign(new Error("remaining connection slots are reserved"), { code: "53300" });
    await expect(unlessUnavailable(async () => Promise.reject(new Error("Failed query", { cause: refused })))).resolves.toEqual({ ok: false });
  });

  it("lets every other error reach the error boundary", async () => {
    const bug = Object.assign(new Error("column does not exist"), { code: "42703" });
    await expect(unlessUnavailable(async () => Promise.reject(bug))).rejects.toBe(bug);
  });
});
