import React from "react";

import { VideoGrid } from "@/components/VideoGrid";
import { FeedSort } from "@/lib/feed-cursor";
import { feedSettings } from "@/lib/feed-settings";
import { t } from "@/lib/i18n";
import { feedPage } from "@/lib/queries";
import { PREVIEW_SIZE } from "@/lib/visitor-home";

/** A placeholder of the preview's height while it streams (no layout shift), said busy to assistive technology. */
export function PreviewPending() {
  return <div aria-busy="true" className="min-h-[22rem] rounded-2xl border border-dashed border-border-default" />;
}

/**
 * The real feed as a visitor sees it: eight items of the visitor's For you, read from the database (adult ratings veiled
 * as for any visitor). Streamed in its own Suspense, so the visitor's hero never waits for the database.
 */
export async function VisitorPreview() {
  const { shortsMaxSeconds } = await feedSettings(new Date()).catch(() => ({ shortsMaxSeconds: undefined }));
  const preview = await feedPage({ sort: FeedSort.ForYou, viewerId: null, limit: PREVIEW_SIZE }, false).catch((error: unknown) => {
    console.error("[home] preview unavailable:", error);
    return { videos: [], nextCursor: null };
  });
  return preview.videos.length ? <VideoGrid videos={preview.videos} shortsMaxSeconds={shortsMaxSeconds} /> : <p className="text-fg-secondary">{t("home.visitor.preview.empty")}</p>;
}
