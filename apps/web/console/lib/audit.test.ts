import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { collectRequestIds, noteRequestId } from "./request-ids";

// Dev preview `admin.audit-log` (formerly orochia-admin#45): every operator action writes an audit row — who, what, when, the
// request id of the call to Orochia — and the console shows it.
const read = (rel: string) => readFileSync(join(__dirname, "..", "..", rel.startsWith("app/") ? `app/console/${rel.slice(4)}` : `console/${rel}`), "utf8");

describe("request ids of the calls an action makes", () => {
  it("collects the ids noted while an action runs, in order, without duplicates", async () => {
    const { ids, value } = await collectRequestIds(async () => {
      noteRequestId("a4d3-YUL");
      noteRequestId("a4d3-YUL");
      await Promise.resolve();
      noteRequestId("b7e1-YYZ");
      return 42;
    });
    expect(value).toBe(42);
    expect(ids).toEqual(["a4d3-YUL", "b7e1-YYZ"]);
  });

  it("notes nothing outside an action, and ignores an empty id", async () => {
    expect(() => noteRequestId("x")).not.toThrow();
    const { ids } = await collectRequestIds(async () => noteRequestId(null));
    expect(ids).toEqual([]);
  });

  it("keeps two actions that run at once apart", async () => {
    const [a, b] = await Promise.all([
      collectRequestIds(async () => { await new Promise((r) => setTimeout(r, 5)); noteRequestId("A"); }),
      collectRequestIds(async () => { noteRequestId("B"); }),
    ]);
    expect(a.ids).toEqual(["A"]);
    expect(b.ids).toEqual(["B"]);
  });
});

describe("every operator action is audited", () => {
  const actions = read("app/actions.ts");

  it("every exported action goes through attempt() with a log entry (action, target)", () => {
    const exported = [...actions.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
    expect(exported.length).toBeGreaterThanOrEqual(14);
    for (const name of exported) {
      const body = actions.slice(actions.indexOf(`export async function ${name}(`)).split(/\nexport async function /)[0];
      expect(body, `${name} must call attempt(...)`).toContain("attempt(");
      expect(body, `${name} must pass a log entry`).toMatch(/\{ action:/);
    }
  });

  it("the audit row carries who, what, when and the request ids; the page shows them", () => {
    const db = read("lib/db.ts");
    expect(db).toContain("actor text");
    expect(db).toContain("request_id text");
    const account = read("lib/account.ts");
    expect(account).toMatch(/INSERT INTO admin_audit \(action, target, ok, detail, actor, request_id, outcome\)/);
    const table = read("components/AuditTable.tsx");
    expect(table).toContain('header: "Who"');
    expect(table).toContain('header: "Request"');
  });

  it("the row also says what it came to (ok, refused, failed) and which area it belongs to; the log filters on both", () => {
    expect(read("lib/db.ts")).toContain("outcome text");
    const actions = read("app/actions.ts");
    expect(actions).toContain("outcomeOf(");
    const table = read("components/AuditTable.tsx");
    expect(table).toContain('header: "Outcome"');
    expect(table).toContain('header: "Area"');
  });

  it("the call to Orochia notes the edge's request id", () => {
    expect(read("lib/orochia.ts")).toMatch(/noteRequestId\(res\.headers\.get\("cf-ray"\)/);
    expect(read("app/actions.ts")).toContain("collectRequestIds(");
  });
});
