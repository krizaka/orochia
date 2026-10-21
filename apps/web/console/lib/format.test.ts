import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { day, fileSize, minutes, money, size, whenCompact, whenLong, whenShort } from "./format";

describe("format", () => {
  it("writes cents as dollars", () => expect(money(123456)).toBe("$1,234.56"));
  it("sizes a quota, null being unlimited", () => {
    expect(size(null)).toBe("unlimited");
    expect(size(5 * 1024 ** 3)).toBe("5.0 GB");
    expect(size(300 * 1024 ** 2)).toBe("300 MB");
  });
  it("minutes of video, null being unlimited", () => {
    expect(minutes(null)).toBe("unlimited");
    expect(minutes(3600)).toBe("60 min");
  });
  it("sizes a backup file with a 1 KB floor", () => {
    expect(fileSize(10)).toBe("1 KB");
    expect(fileSize(2 * 1024 ** 2)).toBe("2.0 MB");
  });

  // React #418 on the audit, creators and auctions screens: the server (UTC) and the browser (any zone) wrote different
  // times. The console pins one zone, the operator's, so both write the same text.
  it("writes an instant in the console's one time zone, whatever the machine's", () => {
    const at = "2026-10-21T02:30:00Z";
    expect(whenLong(at)).toBe("Oct 20, 2026, 10:30:00 PM");
    expect(whenShort(at)).toBe("Oct 20, 2026, 10:30 PM");
    expect(whenCompact(at)).toBe("Oct 20, 10:30 PM");
    expect(day(at)).toBe("Oct 20, 2026");
  });

  it("no console source formats a date without that zone", () => {
    const root = join(__dirname, "..", "..");
    const files = ["console/components/AuditTable.tsx", "app/console/explorer/page.tsx", "app/console/storage/page.tsx", "app/console/app-versions/page.tsx"];
    for (const file of files) expect(readFileSync(join(root, file), "utf8"), file).not.toMatch(/new Date\([^)]*\)\.toLocale(Date)?String/);
  });
});
