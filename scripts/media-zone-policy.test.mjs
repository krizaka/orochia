import { describe, expect, it } from "vitest";

import { applyPolicy, zoneDrift } from "./media-zone-policy.mjs";

// krizaka/orochia#69: the library's pull zone refused every native request (403) because « block requests with no
// Referer » was on, and an iOS/Android player sends none. Protection is the signed token; the referrer list only
// keeps the browsers honest. These are the settings the zone must hold.
const good = { ZoneSecurityEnabled: true, BlockNoneReferrer: false, AllowedReferrers: ["orochia.com", "*.orochia.com", "localhost"] };

describe("the Stream pull zone policy", () => {
  it("accepts token authentication on, no-Referer requests let through, the referrer list kept", () => {
    expect(zoneDrift(good)).toEqual([]);
  });

  it("flags « block no Referer »: native players send none", () => {
    expect(zoneDrift({ ...good, BlockNoneReferrer: true })).toEqual(["BlockNoneReferrer must be false (native apps send no Referer)"]);
  });

  it("never lets the zone go open: token authentication off is drift, and the fix does not touch it", () => {
    const open = { ...good, ZoneSecurityEnabled: false };
    expect(zoneDrift(open)).toEqual(["ZoneSecurityEnabled must be true (signed URLs are the protection)"]);
    expect(applyPolicy(open)).toBeNull();
  });

  it("flags an emptied referrer list: browsers stay limited to the app's domains", () => {
    expect(zoneDrift({ ...good, AllowedReferrers: [] })).toEqual(["AllowedReferrers must keep the app's domains"]);
  });

  it("changes only the no-Referer switch", () => {
    expect(applyPolicy({ ...good, BlockNoneReferrer: true })).toEqual({ BlockNoneReferrer: false });
    expect(applyPolicy(good)).toEqual({});
  });
});
