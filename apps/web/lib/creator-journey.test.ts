import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";

import {
  CREATOR_APPLY_PATH,
  CREATOR_UPLOAD_PATH,
  creatorSpaceCta,
  feedEmptyActions,
  type FeedEmptyKind,
  type FeedTab,
  safeNext,
  signUpHref,
  type ViewerState,
  viewerStateOf,
} from "./creator-journey";

const STATES: ViewerState[] = ["anonymous", "member", "creator-pending", "creator", "suspended"];
const SIGNED_IN: ViewerState[] = ["member", "creator-pending", "creator", "suspended"];
const TABS: FeedTab[] = ["foryou", "trending", "vip", "free", "contacts"];
const KINDS: FeedEmptyKind[] = ["platform", "tab"];

/** Every call to action a viewer can meet: the creator space and the empty feed, in every tab. */
function everyCta(state: ViewerState) {
  return [creatorSpaceCta(state), ...KINDS.flatMap((kind) => TABS.flatMap((tab) => feedEmptyActions(state, kind, tab)))].filter(Boolean);
}

function message(key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
}

describe("viewer state", () => {
  it("reads the account: role, 2257 verification, suspension", () => {
    expect(viewerStateOf(null)).toBe("anonymous");
    expect(viewerStateOf({ role: "MEMBER", isVerified: true })).toBe("member");
    expect(viewerStateOf({ role: "CREATOR", isVerified: false })).toBe("creator-pending");
    expect(viewerStateOf({ role: "CREATOR", isVerified: true })).toBe("creator");
    expect(viewerStateOf({ role: "ADMIN", isVerified: true })).toBe("creator");
    expect(viewerStateOf({ role: "CREATOR", isVerified: true, suspended: true })).toBe("suspended");
    expect(viewerStateOf({ role: "MEMBER", isVerified: true, suspended: true })).toBe("suspended");
  });
});

describe("calls to action per viewer", () => {
  it.each(SIGNED_IN)("never sends a signed-in %s to the sign-up form", (state) => {
    for (const cta of everyCta(state)) expect(cta!.href).not.toMatch(/^\/auth\/register/);
  });

  it("sends a visitor to sign up first, then to the creator application", () => {
    expect(creatorSpaceCta("anonymous")!.href).toBe(`/auth/register?next=${encodeURIComponent(CREATOR_APPLY_PATH)}`);
  });

  it("opens the creator space of the member's own account", () => {
    expect(creatorSpaceCta("member")).toEqual({ href: CREATOR_APPLY_PATH, label: "creatorSpace.cta.member" });
  });

  it("shows a pending creator the status of the review", () => {
    expect(creatorSpaceCta("creator-pending")).toEqual({ href: CREATOR_APPLY_PATH, label: "creatorSpace.cta.pending" });
  });

  it("sends a verified creator to upload", () => {
    expect(creatorSpaceCta("creator")!.href).toBe(CREATOR_UPLOAD_PATH);
    expect(feedEmptyActions("creator", "platform", "foryou")[0]).toMatchObject({ href: CREATOR_UPLOAD_PATH, primary: true });
  });

  it("offers a suspended account nothing", () => {
    expect(everyCta("suspended")).toEqual([]);
  });

  it("an empty Contacts tab: find people when signed in, sign in otherwise", () => {
    expect(feedEmptyActions("member", "tab", "contacts")[0]).toMatchObject({ href: "/explore", label: "feed.actions.findPeople" });
    expect(feedEmptyActions("anonymous", "tab", "contacts")[0].href).toBe("/auth/login?next=%2F%3Ffeed%3Dcontacts");
  });

  it("each block has one primary action at most", () => {
    for (const state of STATES)
      for (const kind of KINDS) for (const tab of TABS) expect(feedEmptyActions(state, kind, tab).filter((c) => c.primary).length).toBeLessThanOrEqual(1);
  });

  it.each(STATES)("every label of %s is a message", (state) => {
    for (const cta of everyCta(state)) expect(typeof message(cta!.label)).toBe("string");
    for (const part of ["title", "body"]) expect(typeof message(`feed.empty.platform.${state}.${part}`)).toBe("string");
  });
});

describe("next", () => {
  it("keeps same-site paths only", () => {
    expect(safeNext("/creator/apply")).toBe("/creator/apply");
    expect(safeNext("//evil.example")).toBeNull();
    expect(safeNext("/\\evil.example")).toBeNull();
    expect(safeNext("https://evil.example")).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(signUpHref()).toBe("/auth/register");
  });
});

describe("with sign-up closed (AUTH_SIGNUP_ENABLED off)", () => {
  it("never offers a sign-up link to a visitor — only to sign in", () => {
    const all = [creatorSpaceCta("anonymous", false), ...KINDS.flatMap((kind) => TABS.flatMap((tab) => feedEmptyActions("anonymous", kind, tab, false)))];
    for (const cta of all) expect(cta!.href).not.toContain("/auth/register");
    expect(creatorSpaceCta("anonymous", false)!.href).toBe(`/auth/login?next=${encodeURIComponent(CREATOR_APPLY_PATH)}`);
  });
});
