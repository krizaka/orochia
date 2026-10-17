"use client";

import { Badge } from "@krizaka/ui/badge";
import { MetaRow } from "@krizaka/ui/meta-row";
import { Popover } from "@krizaka/ui/popover";
import { Check, Copy, Sparkles } from "lucide-react";
import React from "react";

import { type AiCredit, parseAiCredit, shortRunId } from "@/lib/ai-credit";
import type { Translator } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-client";
import { aspectLabel, qualityOf } from "@/lib/video-quality";

export interface VideoInfoData {
  width?: number | null;
  height?: number | null;
  resolutions?: string[] | null;
  framerate?: number | null;
  durationSeconds: number;
  createdAt: string;
  status?: string | null;
  description?: string | null;
}

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

/** The credit line Orazaka-made clips carry in their description ("Made with Orazaka — run <id> (<model>)."). */
export function creditOf(description?: string | null): string | null {
  return parseAiCredit(description)?.line ?? null;
}

function statusLabel(t: Translator, status: string): string {
  switch (status) {
    case "PENDING_UPLOAD":
      return t("info.statuses.PENDING_UPLOAD");
    case "PROCESSING":
      return t("info.statuses.PROCESSING");
    case "READY":
      return t("info.statuses.READY");
    case "FAILED":
      return t("info.statuses.FAILED");
    case "HELD":
      return t("info.statuses.HELD");
    default:
      return status;
  }
}

function fpsOf(t: Translator, framerate?: number | null): string | null {
  return framerate ? t("info.fps", { fps: Number(framerate.toFixed(framerate % 1 < 0.01 ? 0 : 1)) }) : null;
}

function CopyRunId({ runId }: { runId: string }) {
  const { t } = useI18n();
  const [done, setDone] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={done ? t("info.ai.copied") : t("info.ai.copy")}
      title={t("info.ai.copy")}
      onClick={() => {
        void navigator.clipboard?.writeText(runId).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        });
      }}
      className="inline-flex size-6 items-center justify-center rounded-md text-fg-secondary hover:bg-surface-3 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
    >
      {done ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

/** The AI disclosure: one small badge, the provenance (run, model, hardware) in a popover. */
export function AiBadge({ credit }: { credit: AiCredit }) {
  const { t } = useI18n();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" data-testid="ai-badge" aria-label={t("info.ai.title")} className="rounded-full focus-visible:outline-2 focus-visible:outline-accent">
          <Badge tone="accent" size="md">
            <Sparkles className="size-3" aria-hidden />
            {t("info.ai.badge")}
          </Badge>
        </button>
      </Popover.Trigger>
      <Popover.Content align="start" className="w-72 max-w-[calc(100vw-2rem)] p-3 text-sm" data-testid="ai-popover">
        <p className="font-semibold text-fg">{t("info.ai.madeWith")}</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 text-xs">
          {credit.runId && (
            <>
              <dt className="text-fg-secondary">{t("info.ai.run")}</dt>
              <dd className="flex items-center gap-1 font-mono text-fg" data-testid="ai-run">
                <span title={credit.runId}>{shortRunId(credit.runId)}</span>
                <CopyRunId runId={credit.runId} />
              </dd>
            </>
          )}
          {credit.model && (
            <>
              <dt className="text-fg-secondary">{t("info.ai.model")}</dt>
              <dd className="text-fg">{credit.model}</dd>
            </>
          )}
          {credit.hardware && (
            <>
              <dt className="text-fg-secondary">{t("info.ai.hardware")}</dt>
              <dd className="text-fg">{credit.hardware}</dd>
            </>
          )}
        </dl>
      </Popover.Content>
    </Popover.Root>
  );
}

/** What the video is, read from the file: one quiet line under the title, the rest one click away. */
export function VideoInfo({ video }: { video: VideoInfoData }) {
  const { t, date } = useI18n();
  const q = qualityOf(video.resolutions, video.width, video.height);
  const aspect = aspectLabel(video.width, video.height);
  const credit = parseAiCredit(video.description);
  const fps = fpsOf(t, video.framerate);
  const uploaded = date(video.createdAt);
  const notReady = video.status && video.status !== "READY" ? statusLabel(t, video.status) : null;
  const meta = [q?.label ?? (video.width && video.height ? `${video.width}×${video.height}` : null), aspect, clock(video.durationSeconds), fps, uploaded].filter(Boolean) as string[];
  const dash = t("info.unknown");
  const technical: Array<[string, string]> = [
    [t("info.resolution"), video.width && video.height ? `${video.width}×${video.height}` : dash],
    [t("info.aspect"), aspect ?? dash],
    [t("info.duration"), clock(video.durationSeconds)],
    [t("info.framerate"), fps ?? dash],
    [t("info.uploaded"), uploaded],
    [t("info.status"), video.status ? statusLabel(t, video.status) : dash],
  ];
  return (
    <section aria-label={t("info.title")} data-testid="video-info" className="mt-3">
      <MetaRow
        data-testid="video-meta"
        aria-label={t("info.title")}
        items={meta}
        chips={[
          notReady ? (
            <Badge key="status" tone={video.status === "FAILED" ? "danger" : "warning"} size="sm" data-testid="video-status">
              {notReady}
            </Badge>
          ) : null,
          credit ? <AiBadge key="ai" credit={credit} /> : null,
        ]}
      />
      <details className="group mt-2" data-testid="video-technical">
        <summary className="inline-flex cursor-pointer list-none text-xs text-fg-secondary hover:text-fg [&::-webkit-details-marker]:hidden">{t("info.technical")}</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
          {technical.map(([term, value]) => (
            <React.Fragment key={term}>
              <dt className="text-fg-secondary">{term}</dt>
              <dd className="text-fg">{value}</dd>
            </React.Fragment>
          ))}
        </dl>
      </details>
    </section>
  );
}
