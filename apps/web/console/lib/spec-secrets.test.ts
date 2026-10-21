import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const spec = fs.readFileSync(path.resolve(__dirname, "../../../../deploy/digitalocean/app-spec.dev.yaml"), "utf8");

describe("App Platform dev spec — the console served by the platform app", () => {
  it("declares the console's password, tokens and database URL as type SECRET", () => {
    const blocks = spec.split(/\n\s*- key: /).slice(1);
    const sensitive = blocks.filter((b) => /^(AUTH_OPERATOR_PASSWORD|OPERATOR_API_TOKEN|DATABASE_CONSOLE_URL)\b/.test(b));
    expect(sensitive.map((b) => b.split("\n")[0])).toEqual(["OPERATOR_API_TOKEN", "DATABASE_CONSOLE_URL", "AUTH_OPERATOR_PASSWORD"]);
    for (const b of sensitive) expect(b, b.split("\n")[0]).toMatch(/type: SECRET/);
  });

  it("serves admin.orochia.com from this app, beside the platform's primary domain (www since epic krizaka/.github#119)", () => {
    expect(spec).toMatch(/- domain: www\.orochia\.com\s+type: PRIMARY/);
    expect(spec).toMatch(/- domain: dev\.orochia\.com\s+type: ALIAS/);
    expect(spec).toMatch(/- domain: admin\.orochia\.com\s+type: ALIAS/);
    expect(spec).toMatch(/key: AUTH_ALLOWED_IPS/);
  });
});
