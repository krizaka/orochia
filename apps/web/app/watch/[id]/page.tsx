import type { Metadata } from "next";
import { videoDetails } from "@/lib/queries";
import { JsonLd } from "@/components/JsonLd";
import { NOINDEX, absolute, videoSchema } from "@/lib/seo";
import WatchClient from "./WatchClient";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Listed videos only: an invited-only one is described to nobody (its page stays out of every index). */
async function listedVideo(id: string) {
  if (!UUID.test(id)) return null;
  const video = await videoDetails(id).catch(() => null);
  return video && video.visibility !== "INVITED_ONLY" ? video : null;
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  const video = await listedVideo(id);
  if (!video) return { title: t("watch.metaTitle"), robots: NOINDEX };
  const description = (video.description || t("watch.metaDescription", { title: video.title, creator: video.creatorName })).slice(0, 300);
  const images = video.thumbnailUrl ? [{ url: video.thumbnailUrl, width: 1280, height: 720, alt: video.title }] : undefined;
  return {
    title: `${video.title} · ${video.creatorName}`,
    description,
    alternates: { canonical: `/watch/${video.id}` },
    openGraph: { type: "video.other", url: absolute(`/watch/${video.id}`), title: video.title, description, images },
    twitter: { card: "summary_large_image", title: video.title, description, images: images?.map((i) => i.url) },
  };
}

/** The watch page: metadata and VideoObject on the server, the player and its access checks on the client. */
export default async function WatchPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const video = await listedVideo(id);
  return (
    <>
      {video && <JsonLd data={videoSchema(video)} />}
      <WatchClient />
    </>
  );
}
