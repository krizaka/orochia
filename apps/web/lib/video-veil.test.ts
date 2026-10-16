import { describe, expect, it } from "vitest";

import { unveiledThumbnail, veilSummary } from "./video-veil";

const row = { id: "v", title: "t", isBlurred: false, ratingRequiresBlur: false, ratingIsAdult: true };

describe("an 18+ video in a list is veiled for whoever the server has not checked", () => {
  it("a visitor, or a signed-in viewer whose age was never checked, gets it blurred and flagged 18+", () => {
    const out = veilSummary(row, false);
    expect(out).toMatchObject({ id: "v", isBlurred: true, isAdult: true });
  });

  it("an age-checked viewer sees it clear, still flagged 18+", () => {
    expect(veilSummary(row, true)).toMatchObject({ isBlurred: false, isAdult: true });
  });

  it("the creator's own blur and a rating that requires blur hold for everyone", () => {
    expect(veilSummary({ ...row, isBlurred: true }, true).isBlurred).toBe(true);
    expect(veilSummary({ ...row, ratingRequiresBlur: true }, true).isBlurred).toBe(true);
  });

  it("a general video is never veiled and the rating columns do not leak to the client", () => {
    const out = veilSummary({ ...row, ratingIsAdult: false }, false);
    expect(out).toMatchObject({ isBlurred: false, isAdult: false });
    expect(out).not.toHaveProperty("ratingIsAdult");
    expect(out).not.toHaveProperty("ratingRequiresBlur");
  });
});

describe("a surface that has no blur (auction cards) withholds the picture instead", () => {
  const url = "https://cdn.example/t.jpg";
  it("an 18+ picture is withheld from a visitor or an unchecked viewer, given to a checked one", () => {
    expect(unveiledThumbnail(url, row, false)).toBeNull();
    expect(unveiledThumbnail(url, row, true)).toBe(url);
  });
  it("a general picture is always given, a missing one stays missing", () => {
    expect(unveiledThumbnail(url, { ...row, ratingIsAdult: false }, false)).toBe(url);
    expect(unveiledThumbnail(null, row, true)).toBeNull();
  });
});
