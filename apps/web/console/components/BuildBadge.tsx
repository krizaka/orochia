"use client";

import { NavBar } from "@krizaka/ui/nav-bar";
import { Tooltip } from "@krizaka/ui/tooltip";

import { BUILD_INFO, type BuildInfo, buildUrl, showsBuildBadge } from "@/console/lib/build-info";

/** English labels, fixed (the console has no i18n). */
const NOTICE = {
  local: "Local build — running on this machine, not production-ready",
  other: "Development build — still being tested, not production-ready",
};

/**
 * The environment in the header (NAV-SYS: @krizaka/ui's `NavBar.Badge`, `dev`) on every environment but production; the
 * version and the commit (`v1.0.0 · dev · a1b2c3d`) stay in its accessible name, and it links the commit. A private
 * console: no family switcher, no family footer.
 */
export function BuildBadge({ info = BUILD_INFO }: { info?: BuildInfo }) {
  if (!showsBuildBadge(info)) return null;
  const label = [`v${info.version}`, info.env, info.sha].filter(Boolean).join(" · ");
  const notice = info.env === "local" ? NOTICE.local : NOTICE.other;
  return (
    <Tooltip content={notice}>
      <a
        href={buildUrl(info)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Version ${label}. ${notice}. Opens the commit on GitHub.`}
        data-testid="build-badge"
        className="inline-flex shrink-0 rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <NavBar.Badge env={info.env} className="inline-flex" />
      </a>
    </Tooltip>
  );
}
