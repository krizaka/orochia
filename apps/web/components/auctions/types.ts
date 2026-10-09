/** The auction as /api/auctions/[id] returns it (lib/auctions.ts AuctionView). */
export type AuctionPhase = "UPCOMING" | "OPEN" | "ENDING" | "AWAITING_DECISION" | "SOLD" | "DECLINED" | "UNSOLD" | "CANCELLED";

export interface AuctionBid {
  id: string;
  amountCents: number;
  alias: number;
  mine: boolean;
  createdAt: string;
}

export interface Auction {
  id: string;
  status: "OPEN" | "AWAITING_DECISION" | "SOLD" | "DECLINED" | "UNSOLD" | "CANCELLED";
  phase: AuctionPhase;
  rights: "WATCH" | "DOWNLOAD";
  settlement: "CREATOR_DECIDES" | "HIGHEST_BID";
  startingPriceCents: number;
  highestBidCents: number;
  bidsCount: number;
  biddersCount: number;
  minimumNextBidCents: number;
  suggestedBidsCents: number[];
  startsAt: string;
  endsAt: string;
  scheduledEndsAt: string;
  decisionDeadline: string | null;
  serverNow: string;
  video: { id: string; title: string; thumbnailUrl: string | null; durationSeconds: number };
  creator: { username: string; name: string; avatarUrl: string | null };
  leaderAlias: number | null;
  leaderUsername: string | null;
  recentBids: AuctionBid[];
  viewer: { signedIn: boolean; isCreator: boolean; isLeader: boolean; alias: number | null; won: boolean; canDownload: boolean; balanceCents: number | null };
}

export interface AuctionCard {
  id: string;
  phase: AuctionPhase;
  rights: Auction["rights"];
  settlement: Auction["settlement"];
  highestBidCents: number;
  startingPriceCents: number;
  bidsCount: number;
  startsAt: string;
  endsAt: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  creatorUsername: string;
  creatorName: string;
  creatorAvatar: string | null;
  leading?: boolean;
}

/** A bid pushed live to every viewer (lib/auctions.ts announceBid). */
export interface BidEvent {
  type: "bid";
  bid: { id: string; amountCents: number; alias: number; createdAt: string };
  highestBidCents: number;
  bidsCount: number;
  leaderAlias: number;
  endsAt: string;
  extended: boolean;
  minimumNextBidCents: number;
  suggestedBidsCents: number[];
}
