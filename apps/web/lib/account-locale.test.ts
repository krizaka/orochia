import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({ value: [] as { locale: string | null }[] }));
vi.mock("@orochia/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => rows.value }) }) }) },
  users: { locale: "locale", id: "id" },
}));
vi.mock("@/lib/i18n-server", () => import("./i18n-test-server"));

import { languageFor } from "./account-locale";
import { setTestLocale } from "./i18n-test-server";

describe("the language to write to someone in", () => {
  beforeEach(() => setTestLocale("en"));

  it("is the language their account chose", async () => {
    rows.value = [{ locale: "fr" }];
    setTestLocale("en");
    expect(await languageFor("u1")).toBe("fr");
  });

  it("is the language of the request being served when the account chose none", async () => {
    rows.value = [{ locale: null }];
    setTestLocale("fr");
    expect(await languageFor("u1")).toBe("fr");
    expect(await languageFor(null)).toBe("fr");
  });

  it("never trusts a stored value that is not a language", async () => {
    rows.value = [{ locale: "de" }];
    setTestLocale("en");
    expect(await languageFor("u1")).toBe("en");
  });
});
