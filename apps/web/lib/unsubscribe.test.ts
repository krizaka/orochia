import { describe, expect, it } from "vitest";

import { eventsToSilence, signUnsubscribe, verifyUnsubscribe } from "./unsubscribe";

const SECRET = "x".repeat(40);
const USER = "0b3f6c1e-8a64-4f7e-9d2a-5c1e7b9a4d10";

describe("the one-click unsubscribe link (per category)", () => {
  it("is signed for an account and a category", () => {
    const token = signUnsubscribe(USER, "messages", SECRET);
    expect(verifyUnsubscribe(token, SECRET)).toEqual({ userId: USER, category: "messages" });
  });
  it("is refused when altered or signed with another secret", () => {
    const token = signUnsubscribe(USER, "messages", SECRET);
    const [payload, sig] = token.split(".");
    expect(verifyUnsubscribe(`${payload}.${"0".repeat(sig.length)}`, SECRET)).toBeNull();
    expect(verifyUnsubscribe(token, "y".repeat(40))).toBeNull();
    expect(verifyUnsubscribe("garbage", SECRET)).toBeNull();
    expect(verifyUnsubscribe(`${Buffer.from(`${USER}.account`).toString("base64url")}.${sig}`, SECRET)).toBeNull();
  });
  it("is never made for the security category", () => {
    expect(() => signUnsubscribe(USER, "account", SECRET)).toThrow();
  });
  it("silences the e-mails of the category and keeps the other lists", () => {
    const next = eventsToSilence(["newFollower"], "messages");
    expect(next).toEqual(expect.arrayContaining(["newFollower", "newMessage"]));
    expect(next).not.toContain("tipReceived");
  });
});
