"use client";

import React, { useEffect, useState } from "react";

import { Dialog, Sheet, Spinner } from "@/components/ui";
import { VideoPlayer } from "@/components/VideoPlayer";
import { useI18n } from "@/lib/i18n-client";

export interface PlayableVideo {
  id: string;
  title: string;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

/**
 * Plays one of the creator's own videos in a Sheet, without leaving the dashboard. The stream comes from the same
 * `/api/videos/:id/stream` as the watch page: signed for the person who asks, who is the owner here.
 */
export function PlayVideoSheet({ video, onClose }: { video: PlayableVideo | null; onClose: () => void }) {
  const { t } = useI18n();
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const id = video?.id;
  useEffect(() => {
    setStreamUrl(null);
    setFailed(false);
    if (!id) return;
    let cancelled = false;
    void fetch(`/api/videos/${id}/stream`, { cache: "no-store" })
      .then((r) => r.json() as Promise<{ allowed?: boolean; streamUrl?: string }>)
      .then((s) => {
        if (cancelled) return;
        if (s.allowed && s.streamUrl) setStreamUrl(s.streamUrl);
        else setFailed(true);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <Dialog.Root open={video !== null} onOpenChange={(open) => !open && onClose()}>
      <Sheet size="lg" aria-describedby={undefined}>
        <Dialog.Header>
          <Dialog.Title>{video?.title ?? t("owner.playTitle")}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          {video && streamUrl ? (
            <VideoPlayer videoId={video.id} streamUrl={streamUrl} posterUrl={video.thumbnailUrl ?? undefined} width={video.width} height={video.height} title={video.title} />
          ) : failed ? (
            <p role="alert" className="text-sm text-fg-secondary">{t("studio.saveFailed")}</p>
          ) : (
            <div className="flex justify-center py-10"><Spinner /></div>
          )}
        </Dialog.Body>
      </Sheet>
    </Dialog.Root>
  );
}
