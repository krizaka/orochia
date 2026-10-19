import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { proxy } from "../../proxy";
import { consoleRoute, isConsoleHost } from "./host";

// One app, two sites (COST-ADMIN-MERGE, orochia#232): dev.orochia.com is the platform, admin.orochia.com the operator
// console. The console is app/console; the proxy decides by the host, so the public host can never reach it, and the
// console host answers only an address of AUTH_ALLOWED_IPS (sign-in included).
const PUBLIC = "https://dev.example.test";
const ADMIN = "https://admin.example.test";
const call = (base: string, path: string, headers: Record<string, string> = {}, cookie?: string) =>
  proxy(new NextRequest(`${base}${path}`, { headers: { ...headers, ...(cookie ? { cookie } : {}) } }));
const rewrite = (response: Response) => response.headers.get("x-middleware-rewrite");

const settings = process.env as Record<string, string | undefined>;
const before = { ips: settings.AUTH_ALLOWED_IPS, mode: settings.NODE_ENV };
const set = (name: "AUTH_ALLOWED_IPS" | "NODE_ENV", value: string | undefined) => {
  if (value === undefined) delete settings[name];
  else settings[name] = value;
};
afterEach(() => {
  set("AUTH_ALLOWED_IPS", before.ips);
  set("NODE_ENV", before.mode);
});

describe("which host is the console", () => {
  it("is admin.<anything>, nothing else", () => {
    expect(isConsoleHost("admin.orochia.com")).toBe(true);
    expect(isConsoleHost("ADMIN.orochia.com:443")).toBe(true);
    expect(isConsoleHost("dev.orochia.com")).toBe(false);
    expect(isConsoleHost("orochia.com")).toBe(false);
    expect(isConsoleHost("xadmin.orochia.com")).toBe(false);
    expect(isConsoleHost("dev.orochia.com.admin.evil.test")).toBe(false);
    expect(isConsoleHost(null)).toBe(false);
  });

  it("maps every address of the console host into app/console, and none of /console itself", () => {
    expect(consoleRoute("admin.orochia.com", "/")).toEqual({ kind: "rewrite", path: "/console" });
    expect(consoleRoute("admin.orochia.com", "/audit")).toEqual({ kind: "rewrite", path: "/console/audit" });
    expect(consoleRoute("admin.orochia.com", "/api/session")).toEqual({ kind: "rewrite", path: "/console/api/session" });
    expect(consoleRoute("admin.orochia.com", "/console/audit")).toEqual({ kind: "notFound" });
    // The tab icon the layout declares has its file's address; only on the console host.
    expect(consoleRoute("admin.orochia.com", "/console/icon.svg")).toEqual({ kind: "rewrite", path: "/console/icon.svg" });
    expect(consoleRoute("dev.orochia.com", "/console/icon.svg")).toEqual({ kind: "notFound" });
    expect(consoleRoute("dev.orochia.com", "/console/audit")).toEqual({ kind: "notFound" });
    expect(consoleRoute("dev.orochia.com", "/explore")).toEqual({ kind: "next" });
  });
});

describe("the public host never reaches the console", () => {
  it("answers 404 to /console and everything under it, pages, API and files", () => {
    for (const path of ["/console", "/console/", "/console/audit", "/console/login", "/console/api/session", "/console/api/health", "/console/robots.txt", "/console/icon.svg", "/console/users/1/export"]) {
      expect(call(PUBLIC, path).status, path).toBe(404);
    }
  });

  it("does not let an allowed address change that: the address is not what opens the console, the host is", () => {
    set("AUTH_ALLOWED_IPS", "203.0.113.7");
    expect(call(PUBLIC, "/console/audit", { "do-connecting-ip": "203.0.113.7" }, "orochia_admin_session=token").status).toBe(404);
  });

  it("leaves the platform's own addresses as they were (language rewrite, no console header)", () => {
    const explore = call(PUBLIC, "/explore");
    expect(explore.status).toBe(200);
    expect(rewrite(explore)).toBe(`${PUBLIC}/en/explore`);
    expect(rewrite(call(PUBLIC, "/fr/explore"))).toBeNull();
    expect(call(PUBLIC, "/explore").headers.get("x-robots-tag")).toBeNull();
  });
});

describe("the console host: the address list, then the operator session", () => {
  it("answers 403 to an address outside AUTH_ALLOWED_IPS, the sign-in page and the API included", () => {
    set("AUTH_ALLOWED_IPS", "203.0.113.7, 198.51.100.4");
    for (const path of ["/", "/login", "/audit", "/api/session", "/api/users/1/export", "/api/backups/x"]) {
      expect(call(ADMIN, path, { "do-connecting-ip": "192.0.2.99" }).status, path).toBe(403);
    }
  });

  it("lets an allowed address reach the sign-in page, and sends it there without an operator session", () => {
    set("AUTH_ALLOWED_IPS", "203.0.113.7");
    const ip = { "do-connecting-ip": "203.0.113.7" };
    expect(rewrite(call(ADMIN, "/login", ip))).toBe(`${ADMIN}/console/login`);
    const redirect = call(ADMIN, "/audit", ip);
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("location")).toBe(`${ADMIN}/login`);
    expect(rewrite(call(ADMIN, "/audit", ip, "orochia_admin_session=token"))).toBe(`${ADMIN}/console/audit`);
    expect(rewrite(call(ADMIN, "/api/session", ip))).toBe(`${ADMIN}/console/api/session`);
  });

  it("serves nothing of the platform on the console host: its addresses are the console's, so they are 404 there", () => {
    set("AUTH_ALLOWED_IPS", "203.0.113.7");
    const ip = { "do-connecting-ip": "203.0.113.7" };
    // The prefix typed by hand is refused, not doubled.
    expect(call(ADMIN, "/console/audit", ip, "orochia_admin_session=token").status).toBe(404);
    // A platform address is rewritten under /console, where no such page exists.
    expect(rewrite(call(ADMIN, "/en/explore", ip, "orochia_admin_session=token"))).toBe(`${ADMIN}/console/en/explore`);
  });

  it("in production an empty list lets nobody in, and a request without the edge's address is refused", () => {
    set("NODE_ENV", "production");
    set("AUTH_ALLOWED_IPS", "");
    expect(call(ADMIN, "/login", { "do-connecting-ip": "203.0.113.7" }).status).toBe(403);
    set("AUTH_ALLOWED_IPS", "203.0.113.7");
    expect(call(ADMIN, "/login").status).toBe(403);
    set("AUTH_ALLOWED_IPS", undefined);
    expect(call(ADMIN, "/login", { "do-connecting-ip": "203.0.113.7" }).status).toBe(403);
  });

  it("keeps only liveness and robots.txt outside the gate, and never indexes anything", () => {
    set("AUTH_ALLOWED_IPS", "203.0.113.7");
    const stranger = { "do-connecting-ip": "192.0.2.99" };
    const health = call(ADMIN, "/api/health", stranger);
    expect(rewrite(health)).toBe(`${ADMIN}/console/api/health`);
    const robots = call(ADMIN, "/robots.txt", stranger);
    expect(rewrite(robots)).toBe(`${ADMIN}/console/robots.txt`);
    expect(robots.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(call(ADMIN, "/login", { "do-connecting-ip": "203.0.113.7" }).headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("does not take the platform's language, cookie or headers from the console host", () => {
    set("AUTH_ALLOWED_IPS", "203.0.113.7");
    const response = call(ADMIN, "/login", { "do-connecting-ip": "203.0.113.7", "accept-language": "fr-CA" });
    expect(response.cookies.get("NEXT_LOCALE")).toBeUndefined();
    expect(rewrite(response)).toBe(`${ADMIN}/console/login`);
  });
});
