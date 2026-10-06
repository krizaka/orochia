import { relations } from "drizzle-orm";
import { users, profiles } from "./users";
import { contacts } from "./contacts";
import { videos, videoAccessGrants } from "./videos";
import { playlists, playlistItems } from "./playlists";
import { tipsLedger, payoutRequests } from "./ledger";

export * from "./enums";
export * from "./users";
export * from "./contacts";
export * from "./videos";
export * from "./playlists";
export * from "./ledger";

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  videos: many(videos),
  playlists: many(playlists),
  sentTips: many(tipsLedger, { relationName: "sender" }),
  receivedTips: many(tipsLedger, { relationName: "creator" }),
  accessGrants: many(videoAccessGrants),
  payoutRequests: many(payoutRequests),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  creator: one(users, {
    fields: [videos.creatorId],
    references: [users.id],
  }),
  accessGrants: many(videoAccessGrants),
  playlistItems: many(playlistItems),
  tips: many(tipsLedger),
}));

export const videoAccessGrantsRelations = relations(videoAccessGrants, ({ one }) => ({
  video: one(videos, {
    fields: [videoAccessGrants.videoId],
    references: [videos.id],
  }),
  user: one(users, {
    fields: [videoAccessGrants.userId],
    references: [users.id],
  }),
}));

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  creator: one(users, {
    fields: [playlists.creatorId],
    references: [users.id],
  }),
  items: many(playlistItems),
}));

export const playlistItemsRelations = relations(playlistItems, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistItems.playlistId],
    references: [playlists.id],
  }),
  video: one(videos, {
    fields: [playlistItems.videoId],
    references: [videos.id],
  }),
}));

export const tipsLedgerRelations = relations(tipsLedger, ({ one }) => ({
  sender: one(users, {
    fields: [tipsLedger.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  creator: one(users, {
    fields: [tipsLedger.creatorId],
    references: [users.id],
    relationName: "creator",
  }),
  video: one(videos, {
    fields: [tipsLedger.videoId],
    references: [videos.id],
  }),
}));

export const payoutRequestsRelations = relations(payoutRequests, ({ one }) => ({
  creator: one(users, {
    fields: [payoutRequests.creatorId],
    references: [users.id],
  }),
}));
