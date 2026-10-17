import { AuctionIcon, ChallengeIcon, TipIcon, UnlockIcon } from "@krizaka/icons";

import type { TourClip } from "@/lib/site-media";

/**
 * The page's structure — its words are messages `howItWorks.steps.<id>` and `howItWorks.ways.<id>`.
 * The journey is the seven steps of one fan and one creator, each shown by the real recording of that moment.
 */
export const JOURNEY = [
  { id: "find", clip: "alex-discover" },
  { id: "watch", clip: "showcase" },
  { id: "tip", clip: "alex-story" },
  { id: "unlock", clip: "alex-unlock" },
  { id: "bid", clip: "alex-bid" },
  { id: "back", clip: "alex-back" },
  { id: "earn", clip: "elena-earnings" },
] as const satisfies readonly { id: string; clip: TourClip }[];

export type JourneyStep = (typeof JOURNEY)[number];

/** The four ways to pay a creator, each with its moment from the app and the documentation that explains it. */
export const WAYS = [
  { id: "tip", clip: "alex-story", icon: TipIcon, href: "/docs/creator-onboarding" },
  { id: "unlock", clip: "alex-unlock", icon: UnlockIcon, href: "/docs/creator-onboarding" },
  { id: "auction", clip: "alex-bid", icon: AuctionIcon, href: "/docs/auctions" },
  { id: "goal", clip: "alex-back", icon: ChallengeIcon, href: "/docs/challenges" },
] as const satisfies readonly { id: string; clip: TourClip; icon: unknown; href: string }[];
