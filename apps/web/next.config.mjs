import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// One .env for the whole monorepo, at its root. Next has already loaded apps/web/.env* by now, and
// loadEnvFile never overrides a variable that is set, so those (and the real environment) still win.
const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
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
