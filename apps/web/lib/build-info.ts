/**
 * What this build is — version, environment, commit — inlined at build time by next.config.mjs. Every environment
 * but production carries a small badge next to the brand (`components/BuildBadge.tsx`), so nobody takes a build that
 * is still being tested for the production one.
 */

export const APP_ENVS = ["local", "dev", "staging", "production"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export interface BuildInfo {
  /** The web app's package.json version. */
  version: string;
  /** Where it runs: `NEXT_PUBLIC_APP_ENV`, `local` when unset or unknown. */
  env: AppEnv;
  /** The short commit SHA, or null when the build could not tell. */
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

/** The badge is shown everywhere but production. */
export function showsBuildBadge(info: BuildInfo): boolean {
  return info.env !== "production";
}

/** The commit on GitHub, or the repository when the SHA is unknown. */
export function buildUrl(info: BuildInfo): string {
  return info.sha ? `${REPOSITORY_URL}/commit/${info.sha}` : REPOSITORY_URL;
}

/** This build. The references are literal so Next inlines them in the client bundle. */
export const BUILD_INFO: BuildInfo = describeBuild({
  version: process.env.NEXT_PUBLIC_APP_VERSION,
  env: process.env.NEXT_PUBLIC_APP_ENV,
  sha: process.env.NEXT_PUBLIC_COMMIT_SHA,
});
