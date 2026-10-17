import { notFound, redirect } from "next/navigation";

import { auctionIdOr404, auctionView } from "@/lib/auctions";

export const dynamic = "force-dynamic";

/** An auction's own address (the one the app opens): its video's page carries the live panel. */
export default async function AuctionPage(props: { params: Promise<{ id: string }> }) {
  const auction = await auctionView(auctionIdOr404((await props.params).id), null, false).catch(() => null);
  if (!auction) notFound();
  redirect(`/watch/${auction.video.id}`);
}
