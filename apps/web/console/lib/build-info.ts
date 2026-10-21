/**
 * What this build is — version, environment, commit — inlined at build time by next.config.mjs (the same badge as
 * Orochia's top bar). Every environment but production shows it in the header, so a console that is still being
 * tested is never taken for the production one.
 */

export const APP_ENVS = ["local", "dev", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export interface BuildInfo {
  version: string;
  env: AppEnv;
  sha: string | null;
}

const REPOSITORY_URL = "https://github.com/krizaka/orochia";

export function parseAppEnv(raw: string | undefined): AppEnv {
  const value = raw?.trim().toLowerCase();
  return (APP_ENVS as readonly string[]).includes(value ?? "") ? (value as AppEnv) : "local";
}

export function describeBuild(raw: { version?: string; env?: string; sha?: string }): BuildInfo {
  const sha = raw.sha?.trim().slice(0, 7).toLowerCase() ?? "";
  return {
    version: raw.version?.trim() || "0.0.0",
    env: parseAppEnv(raw.env),
    sha: /^[0-9a-f]{7}$/.test(sha) ? sha : null,
  };
}

export const showsBuildBadge = (info: BuildInfo) => info.env !== "production";

export const buildUrl = (info: BuildInfo) => (info.sha ? `${REPOSITORY_URL}/commit/${info.sha}` : REPOSITORY_URL);

/** This build. The references are literal so Next inlines them in the client bundle. */
export const BUILD_INFO: BuildInfo = describeBuild({
  version: process.env.NEXT_PUBLIC_APP_VERSION,
  env: process.env.NEXT_PUBLIC_APP_ENV,
  sha: process.env.NEXT_PUBLIC_APP_COMMIT_SHA,
});
