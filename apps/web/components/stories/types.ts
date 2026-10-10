/** A story as /api/stories sends it to the browser (dates as ISO strings). See lib/stories.ts → StoryItem. */
export interface StoryItem {
  id: string;
  type: "image" | "video";
  /** Your own video stories arrive "processing" while Bunny encodes them (or "failed"); others' are always "ready". */
  state: "ready" | "processing" | "failed";
  url: string;
  thumbnailUrl: string | null;
  caption: string;
  durationSeconds: number;
  createdAt: string;
  expiresAt: string;
  viewsCount: number;
  likesCount: number;
  seen: boolean;
  liked: boolean;
  audience: StoryAudienceId;
  audienceListName: string | null;
  isBlurred: boolean;
  tipsCount: number;
}

export type StoryAudienceId = "PUBLIC" | "APPROVED_FOLLOWERS_ONLY" | "CONTACTS_ONLY" | "INVITED_ONLY" | "CHALLENGE" | "TIPPED_UNLOCKED" | "AUCTION";

/** The audiences a creator chooses for a story (CHALLENGE is set by delivering one, never chosen). */
export const STORY_AUDIENCE_CHOICES = ["PUBLIC", "APPROVED_FOLLOWERS_ONLY", "CONTACTS_ONLY", "INVITED_ONLY"] as const;

export interface StoryRing {
  creatorId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOwn: boolean;
  allSeen: boolean;
  minTipCents: number;
  stories: StoryItem[];
}
