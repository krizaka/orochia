import type { videos } from "@orochia/db";

/** Who may watch a video (videos.visibility) — derived from the schema, safe to import in client components. */
export type VideoVisibility = (typeof videos.$inferSelect)["visibility"];

/** The audiences a creator picks in a form. AUCTION and CHALLENGE are not: a video becomes one by being auctioned or delivered for a challenge. */
export const CHOOSABLE_VISIBILITIES = ["PUBLIC", "APPROVED_FOLLOWERS_ONLY", "CONTACTS_ONLY", "TIPPED_UNLOCKED", "INVITED_ONLY"] as const;
export type ChoosableVisibility = (typeof CHOOSABLE_VISIBILITIES)[number];
