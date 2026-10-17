import { describe, expect, it } from "vitest";

import config from "../../../app-links.json";
import { androidFingerprints, appleAppSiteAssociation, assetLinks } from "./app-links";

describe("universal links and App Links files", () => {
  it("the AASA claims every configured path for the bundle id, with the Team ID read from config", () => {
    const aasa = appleAppSiteAssociation("ABCDE12345");
    expect(aasa).not.toBeNull();
    const detail = aasa!.applinks.details[0];
    expect(detail.appIDs).toEqual([`ABCDE12345.${config.iosBundleId}`]);
    expect(detail.components.map((c) => c["/"])).toEqual(config.paths);
    expect(aasa!.applinks.apps).toEqual([]);
  });

  it("without a Team ID there is no AASA (fails closed, never a placeholder)", () => {
    expect(appleAppSiteAssociation(undefined)).toBeNull();
    expect(appleAppSiteAssociation("not-a-team-id")).toBeNull();
  });

  it("assetlinks.json names the package and the signing certificate fingerprints", () => {
    const fp = Array.from({ length: 32 }, () => "AB").join(":");
    expect(androidFingerprints(` ${fp} , ${fp.toLowerCase()} ,bad`)).toEqual([fp, fp]);
    const links = assetLinks([fp]);
    expect(links).toEqual([{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: config.androidPackage, sha256_cert_fingerprints: [fp] } }]);
    expect(assetLinks([])).toBeNull();
  });
});
