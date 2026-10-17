import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { docsRedirects } from "./lib/docs-redirects.mjs";

// One .env for the whole monorepo, at its root. Next has already loaded apps/web/.env* by now, and
// loadEnvFile never overrides a variable that is set, so those (and the real environment) still win.
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/**
 * What this build is, inlined at build time for the version badge next to the brand (components/BuildBadge.tsx):
 * the web app's package.json version, the short commit SHA — `APP_COMMIT_SHA` when the builder provides it (App Platform:
 * `${_self.COMMIT_HASH}`, its Docker build has no .git), else `git rev-parse` — and NEXT_PUBLIC_APP_ENV
 * (local · dev · staging · production; the badge never shows in production).
 */
function commitSha() {
  const given = process.env.APP_COMMIT_SHA?.trim();
  if (given) return given.slice(0, 7);
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}
// The private dashboard moved from /dashboard?tab=… (and /earnings, /insights) to real addresses under /me.
const meRoutes = JSON.parse(readFileSync(new URL("./lib/me-routes.json", import.meta.url), "utf8"));
const appVersion = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

/** @type {import('next').NextConfig} */

const production = process.env.NODE_ENV === "production";

/**
 * Content Security Policy. Next.js renders inline bootstrap scripts without a nonce here, so scripts keep
 * 'unsafe-inline'; the policy still closes what matters: no plugin (object-src), no foreign framing of Orochia
 * (frame-ancestors), no <base> hijack, forms only to us or https (payment checkouts), frames only from Cloudflare
 * Turnstile (the bot challenge), workers only from us or blob: (ffmpeg.wasm), scripts only from us, Turnstile and the
 * ffmpeg core CDN. Media, pictures and API calls go to https (and blob: — ffmpeg.wasm fetches its core from a blob URL) (Bunny Stream, the CDN, Tus) — their hosts are deployment
 * settings, so they are not listed one by one. Development adds what the dev server needs (eval, websockets).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://challenges.cloudflare.com https://cdn.jsdelivr.net${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' blob: data: https: wss:${production ? "" : " ws: http://localhost:* http://127.0.0.1:*"}`,
  "frame-src 'self' https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https:",
  "frame-ancestors 'none'",
  ...(production ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Sign-in providers and payment checkouts are full-page redirects, never popups: the window can be isolated.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_APP_COMMIT_SHA: commitSha(),
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV?.trim() || "local",
  },
  transpilePackages: ["@orochia/db", "@orochia/media", "@orochia/payments", "@orochia/config"],
  // The Redis client (@krizaka/realtime/redis) stays a Node module, required at run time — it connects only with REALTIME_BUS=redis.
  serverExternalPackages: ["ioredis"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // A profile's address is orochia.com/@username — the same for members and creators. The page lives in
  // app/creators/[username]; its old address redirects permanently.
  async rewrites() {
    // The proxy puts a language in front of every address, so the profile address is matched with and without it.
    return [
      { source: "/:locale(en|fr)/@:username", destination: "/:locale/creators/:username" },
      { source: "/@:username", destination: "/creators/:username" },
    ];
  },
  async redirects() {
    return [
      { source: "/creators/:username", destination: "/@:username", permanent: true },
      { source: "/:locale(en|fr)/creators/:username", destination: "/:locale/@:username", permanent: true },
      // Earnings and payouts live on one page.
      { source: "/creator/payouts", destination: "/me/earnings#payouts", permanent: true },
      ...Object.entries(meRoutes.tabs).map(([tab, destination]) => ({ source: "/dashboard", has: [{ type: "query", key: "tab", value: tab }], destination, permanent: true })),
      ...Object.entries(meRoutes.pages).map(([source, destination]) => ({ source, destination, permanent: true })),
      { source: "/dashboard/:path*", destination: "/me", permanent: true },
      // The technical pages of the documentation moved to /docs/developers.
      ...docsRedirects(),
    ];
  },
  async headers() {
    // A site that is not indexed (APP_SEARCH_INDEXING=off: dev, preview) says so on every response, as well as in robots.txt and
    // the pages' robots meta. Read at build time, like lib/seo.ts INDEXABLE.
    const robotsHeader = process.env.APP_SEARCH_INDEXING === "off" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] : [];
    return [
      { source: "/:path*", headers: [...securityHeaders, ...robotsHeader] },
      // A page is written in the language of its address, its cookie or the browser's: caches must tell them apart.
      { source: "/((?!_next/static|_next/image).*)", headers: [{ key: "Vary", value: "Accept-Language, Cookie" }] },
    ];
  },
};

export default nextConfig;
