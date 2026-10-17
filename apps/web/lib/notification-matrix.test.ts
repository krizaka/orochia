import { describe, expect, it } from "vitest";

import {
  applyPreset,
  CATEGORIES,
  categoryOf,
  eventsOf,
  matrixFromOff,
  offFromMatrix,
  PRESETS,
  presetOf,
  SECURITY_CATEGORY,
  unsubscribable,
} from "./notification-matrix";
import { NOTIFICATION_EVENTS } from "./profile";

describe("five categories, two channels (krizaka/orochia#261)", () => {
  it("names the five categories of the issue", () => {
    expect(CATEGORIES).toEqual(["messages", "follows", "earnings", "auctionsChallenges", "account"]);
  });

  it("puts every notification event in exactly one category", () => {
    for (const event of NOTIFICATION_EVENTS) expect(CATEGORIES).toContain(categoryOf(event));
    const counted = CATEGORIES.flatMap((c) => eventsOf(c));
    expect([...counted].sort()).toEqual([...NOTIFICATION_EVENTS].sort());
  });

  it("files the events where a person would look for them", () => {
    expect(categoryOf("newMessage")).toBe("messages");
    expect(categoryOf("newComment")).toBe("follows");
    expect(categoryOf("videoReady")).toBe("account");
    expect(categoryOf("creatorPublished")).toBe("follows");
    expect(categoryOf("tipReceived")).toBe("earnings");
    expect(categoryOf("auctionOutbid")).toBe("auctionsChallenges");
    expect(categoryOf("challengeFunded")).toBe("auctionsChallenges");
    expect(categoryOf("storageLow")).toBe("account");
  });
});

describe("the matrix and the two lists it is stored in", () => {
  it("everything on = empty off-lists", () => {
    const m = matrixFromOff([], []);
    expect(CATEGORIES.every((c) => m[c].app && m[c].email)).toBe(true);
    expect(offFromMatrix(m)).toEqual({ inAppOff: [], emailsOff: [] });
  });

  it("a category is on for a channel only when all its events are", () => {
    const m = matrixFromOff(["newMessage"], []);
    expect(m.messages.app).toBe(false);
    expect(m.messages.email).toBe(true);
    expect(m.follows.app).toBe(true);
  });

  it("round-trips: turning a category off turns off all its events, and no other", () => {
    const m = matrixFromOff([], []);
    m.earnings.email = false;
    const { inAppOff, emailsOff } = offFromMatrix(m);
    expect(emailsOff.sort()).toEqual(eventsOf("earnings").sort());
    expect(inAppOff).toEqual([]);
  });
});

describe("presets", () => {
  it("offers three: everything, the essentials, nothing but security", () => {
    expect(PRESETS).toEqual(["all", "essentials", "securityOnly"]);
  });

  it("all: everything on", () => {
    expect(presetOf(matrixFromOff([], []))).toBe("all");
    expect(applyPreset("all")).toEqual(matrixFromOff([], []));
  });

  it("essentials: messages and account by e-mail and in the app, earnings and auctions in the app only, no follow e-mail", () => {
    const m = applyPreset("essentials");
    expect(m.messages).toEqual({ app: true, email: true });
    expect(m.account).toEqual({ app: true, email: true });
    expect(m.earnings).toEqual({ app: true, email: true });
    expect(m.auctionsChallenges).toEqual({ app: true, email: false });
    expect(m.follows).toEqual({ app: true, email: false });
    expect(presetOf(m)).toBe("essentials");
  });

  it("security only: everything off except the account category", () => {
    const m = applyPreset("securityOnly");
    expect(m.account).toEqual({ app: true, email: true });
    expect(CATEGORIES.filter((c) => c !== SECURITY_CATEGORY).every((c) => !m[c].app && !m[c].email)).toBe(true);
    expect(presetOf(m)).toBe("securityOnly");
  });

  it("a hand-made mix is no preset", () => {
    const m = matrixFromOff(["newMessage"], []);
    expect(presetOf(m)).toBeNull();
  });
});

describe("security mails can never be turned off", () => {
  it("the account category stays on whatever the matrix says", () => {
    const m = matrixFromOff([], []);
    m.account = { app: false, email: false };
    expect(offFromMatrix(m).emailsOff).not.toEqual(expect.arrayContaining(eventsOf("account")));
    expect(offFromMatrix(m).inAppOff).not.toEqual(expect.arrayContaining(eventsOf("account")));
  });
  it("and cannot be unsubscribed from a link", () => {
    expect(unsubscribable("account")).toBe(false);
    expect(unsubscribable("messages")).toBe(true);
  });
});
