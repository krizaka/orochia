import type { Metadata } from "next";
import { headers } from "next/headers";

import { JsonLd } from "@/components/JsonLd";
import { aiCreditOf } from "@/lib/ai-credit";
import { getCurrentUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n-server";
import { videoDetails } from "@/lib/queries";
import { absolute, NOINDEX, videoSchema } from "@/lib/seo";
import { pageAlternates } from "@/lib/seo-i18n";
import { resolveStreamAccess } from "@/lib/stream-access";
import { hasBurnedWatermark } from "@/lib/watermark";

import WatchClient from "./WatchClient";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Listed videos only: an invited-only one is described to nobody (its page stays out of every index). */
async function listedVideo(id: string) {
  if (!UUID.test(id)) return null;
  const video = await videoDetails(id).catch(() => null);
  return video && video.visibility !== "INVITED_ONLY" ? video : null;
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { t } = await getI18n();
  const { id } = await props.params;
  const video = await listedVideo(id);
  if (!video) return { title: t("watch.metaTitle"), robots: NOINDEX };
  const description = (video.description || t("watch.metaDescription", { title: video.title, creator: video.creatorName })).slice(0, 300);
  // An 18+ picture never goes out as a link preview (Open Graph, Twitter cards).
  const images = video.thumbnailUrl && !video.isAdult ? [{ url: video.thumbnailUrl, width: 1280, height: 720, alt: video.title }] : undefined;
  return {
    title: `${video.title} · ${video.creatorName}`,
    description,
    alternates: await pageAlternates(`/watch/${video.id}`),
    openGraph: { type: "video.other", url: absolute(`/watch/${video.id}`), title: video.title, description, images },
    twitter: { card: "summary_large_image", title: video.title, description, images: images?.map((i) => i.url) },
  };
}

/**
 * The access decision and the signed HLS URL, on the server with the page: the player has its source in the first HTML,
 * with no client round-trip before the first frame. A failure here is not an answer: the client asks again.
 */
async function initialStream(id: string) {
  if (!UUID.test(id)) return undefined;
  try {
    const user = await getCurrentUser();
    const { status, body } = await resolveStreamAccess(id, user, await headers());
    return status === 404 || status === 409 ? undefined : body;
  } catch {
    return undefined;
  }
}

/** The watch page: metadata, VideoObject and the signed stream on the server, the player and its controls on the client. */
export default async function WatchPage(props: { params: Promise<{ id: string }> }) {
  const { t } = await getI18n();
  const { id } = await props.params;
  const [video, stream] = await Promise.all([listedVideo(id), initialStream(id)]);
  return (
    <>
      {video && <JsonLd data={videoSchema(video, t)} />}
      <WatchClient initial={{ stream, poster: video?.thumbnailUrl ?? null, width: video?.width ?? null, height: video?.height ?? null, burnedWatermark: hasBurnedWatermark(video?.createdAt, process.env.MEDIA_WATERMARK_SINCE), aiGenerated: video ? aiCreditOf(video) !== null : false }} />
    </>
  );
}
