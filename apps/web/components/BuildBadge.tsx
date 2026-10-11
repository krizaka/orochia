"use client";

import { Badge, cn, Tooltip } from "@/components/ui";
import { BUILD_INFO, type BuildInfo, buildUrl, showsBuildBadge } from "@/lib/build-info";
import { t } from "@/lib/i18n";

/**
 * The build next to the brand — `v1.0.0 · dev · a1b2c3d` — on every environment but production, so a build that is
 * still being tested is never taken for the production one. Phones show the environment only; the tooltip and the
 * accessible name carry the whole build, and the badge opens its commit on GitHub.
 */
export function BuildBadge({ info = BUILD_INFO, className }: { info?: BuildInfo; className?: string }) {
  if (!showsBuildBadge(info)) return null;
  const env = t(`build.env.${info.env}`);
  const label = info.sha
    ? t("build.label", { version: info.version, env, sha: info.sha })
    : t("build.labelNoSha", { version: info.version, env });
  const notice = t(info.env === "local" ? "build.noticeLocal" : "build.notice");

  return (
    <Tooltip content={notice}>
      <a
        href={buildUrl(info)}
        target="_blank"
        rel="noreferrer"
        aria-label={t("build.ariaLabel", { label, notice })}
        data-testid="build-badge"
        className={cn(
          "inline-flex shrink-0 rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <Badge tone="warning" className="font-mono normal-case tracking-normal transition-colors hover:bg-warning/25">
          <span className="sm:hidden">{env}</span>
          <span className="hidden sm:inline">{label}</span>
        </Badge>
      </a>
    </Tooltip>
  );
}
