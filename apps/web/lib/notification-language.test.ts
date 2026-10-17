import { describe, expect, it } from "vitest";

import { toolsFor } from "./i18n";
import { mailPath } from "./locales";
import { i18nVar, moneyVar } from "./notification-vars";
import { notificationText } from "./notifications";
import { resetLink, verificationLink } from "./account-tokens";

describe("a notification is written in the language of whoever reads it", () => {
  const vars = { name: "Ada", action: i18nVar("notify.newFollower.asks") };

  it("says the same event in English and in French, words inside the variables included", () => {
    expect(notificationText(toolsFor("en"), "newFollower", vars)).toBe("Ada asks to follow you.");
    expect(notificationText(toolsFor("fr"), "newFollower", vars)).toBe("Ada demande à vous suivre.");
  });

  it("writes an amount stored as cents in the reader's money format", () => {
    const tip = { name: "Ada", amount: moneyVar(500), title: "" };
    expect(notificationText(toolsFor("en"), "tipReceived", tip)).toContain("$5.00");
    expect(notificationText(toolsFor("fr"), "tipReceived", tip).replace(/\s/g, " ")).toContain("5,00 $");
  });

  it("names a missing person in the reader's language", () => {
    const vars2 = { name: i18nVar("notify.someone"), amount: moneyVar(100), title: "" };
    expect(notificationText(toolsFor("fr"), "tipReceived", vars2)).toContain("Quelqu’un");
  });
});

describe("the links of an e-mail open the page in the language it is written in", () => {
  it("leaves English links plain and puts French ones under /fr", () => {
    expect(mailPath("/watch/1", "en")).toBe("/watch/1");
    expect(mailPath("/watch/1", "fr")).toBe("/fr/watch/1");
    expect(mailPath("/me/settings#settings-notifications", "fr")).toBe("/fr/me/settings#settings-notifications");
    expect(verificationLink("abc")).toMatch(/\/auth\/verify\?token=abc$/);
    expect(verificationLink("abc", "fr")).toMatch(/\/fr\/auth\/verify\?token=abc$/);
    expect(resetLink("abc", "fr")).toMatch(/\/fr\/auth\/reset-password\?token=abc$/);
  });
});
