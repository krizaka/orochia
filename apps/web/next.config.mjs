import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// One .env for the whole monorepo, at its root. Next has already loaded apps/web/.env* by now, and
// loadEnvFile never overrides a variable that is set, so those (and the real environment) still win.
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

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
  transpilePackages: ["@orochia/db", "@orochia/media", "@orochia/payments", "@orochia/config"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // A profile's address is orochia.com/@username — the same for members and creators. The page lives in
  // app/creators/[username]; its old address redirects permanently.
  async rewrites() {
    return [{ source: "/@:username", destination: "/creators/:username" }];
  },
  async redirects() {
    return [
      { source: "/creators/:username", destination: "/@:username", permanent: true },
      // Earnings and payouts live on one page.
      { source: "/creator/payouts", destination: "/earnings#payouts", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
