import { describe, expect, it } from "vitest";

import { GET } from "./route";

// Dev preview `admin.noindex`: https://admin.orochia.com/robots.txt answers 200 « Disallow: / » to any address (the proxy
// rewrites the admin host's /robots.txt here before the address gate). A metadata `robots.ts` below app/console is not
// served at that address, which is why this is a route.
describe("the console's robots.txt", () => {
  it("shuts the door to every crawler, with noindex, and is not cached for long", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(await res.text()).toBe("User-agent: *\nDisallow: /\n");
  });
});
