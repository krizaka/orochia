import { describe, expect, it } from "vitest";
import { ageOn, checkDateOfBirth, normalizeHandle, normalizeWebsite, parseNotificationsOff, parseSocialLinks, profileImageUrl, socialLinksView } from "./profile";
import { wants } from "./notifications";

describe("social links", () => {
  it("takes a handle, an @handle or a link to that network", () => {
    expect(normalizeHandle("instagram", "@velvet.noir")).toBe("velvet.noir");
    expect(normalizeHandle("instagram", "https://www.instagram.com/velvet.noir/")).toBe("velvet.noir");
    expect(normalizeHandle("x", "twitter.com/velvet")).toBe("velvet");
    expect(normalizeHandle("tiktok", "https://www.tiktok.com/@velvet")).toBe("velvet");
    expect(normalizeHandle("youtube", "  ")).toBeNull();
  });

  it("refuses links to another site and anything that is not a handle", () => {
    expect(() => normalizeHandle("instagram", "https://evil.example/velvet")).toThrow(/not a instagram link/);
    expect(() => normalizeHandle("x", "javascript:alert(1)")).toThrow();
    expect(() => normalizeHandle("facebook", "a b")).toThrow();
  });

  it("stores handles only and builds the URLs itself", () => {
    expect(parseSocialLinks({ instagram: "@me", x: "", unknown: "x" })).toEqual({ instagram: "me" });
    expect(socialLinksView({ telegram: "me", instagram: "bad handle!" })).toEqual([{ network: "telegram", handle: "me", url: "https://t.me/me" }]);
  });

  it("accepts web addresses only for the website", () => {
    expect(normalizeWebsite("my-site.com")).toBe("https://my-site.com/");
    expect(() => normalizeWebsite("javascript:alert(1)")).toThrow();
    expect(normalizeWebsite("")).toBeNull();
  });
});

describe("profile pictures", () => {
  it("come from a preset, an upload reference or what is already there — never a client URL", () => {
    expect(profileImageUrl("avatar", "avatar-03", null)).toBe("/defaults/avatars/avatar-03.svg");
    expect(profileImageUrl("banner", "banners/0f8e2a9c-5b7d-4e1a-9c3b-2d4f6a8b0c1e.jpg", null)).toBe("/uploads/banners/0f8e2a9c-5b7d-4e1a-9c3b-2d4f6a8b0c1e.jpg");
    expect(profileImageUrl("avatar", "https://g.co/a.png", "https://g.co/a.png")).toBe("https://g.co/a.png");
    expect(profileImageUrl("avatar", null, "/x.png")).toBeNull();
    expect(() => profileImageUrl("avatar", "https://tracker.example/pixel.gif", null)).toThrow();
    expect(() => profileImageUrl("avatar", "documents/0f8e2a9c-5b7d-4e1a-9c3b-2d4f6a8b0c1e.jpg", null)).toThrow();
  });
});

describe("date of birth", () => {
  const today = new Date("2026-10-08T12:00:00Z");
  it("counts whole years", () => {
    expect(ageOn("2008-10-08", today)).toBe(18);
    expect(ageOn("2008-10-09", today)).toBe(17);
  });
  it("lets adults in and keeps minors out", () => {
    expect(checkDateOfBirth("2008-10-08", today)).toBe("2008-10-08");
    expect(() => checkDateOfBirth("2008-10-09", today)).toThrow(/18 or older/);
    expect(() => checkDateOfBirth("2012-02-30", today)).toThrow(/Invalid/);
    expect(() => checkDateOfBirth("1890-01-01", today)).toThrow(/Invalid/);
  });
});

describe("notifications", () => {
  it("are all on until one is turned off", () => {
    expect(wants([], "newComment")).toBe(true);
    expect(wants(["newComment"], "newComment")).toBe(false);
    expect(parseNotificationsOff(["newComment", "nope"])).toEqual(["newComment"]);
  });
});
