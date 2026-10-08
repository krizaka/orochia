import { relations } from "drizzle-orm";
import { users, profiles } from "./users";
import { contacts, follows } from "./contacts";
import { videos, videoAccessGrants } from "./videos";
import { playlists, playlistItems, playlistMembers } from "./playlists";
import { videoComments, videoLikes, videoShares, videoViews } from "./engagement";
import { audienceLists, audienceListMembers } from "./audiences";
import { tipsLedger, payoutRequests } from "./ledger";
import { stories, storyViews, storyLikes } from "./stories";
import { contentRatings } from "./reference-data";
import { userInvitations } from "./invitations";
import { conversations, directMessages, blockedUsers } from "./messaging";
import { paymentOutbox } from "./payment-outbox";

export * from "./enums";
export * from "./users";
export * from "./contacts";
export * from "./videos";
export * from "./playlists";
export * from "./engagement";
export * from "./audiences";
export * from "./auth-tokens";
export * from "./auth-identities";
export * from "./ledger";
export * from "./compliance";
export * from "./stories";
export * from "./drafts";
export * from "./notifications";
export * from "./wallet";
export * from "./reference-data";
export * from "./invitations";
export * from "./messaging";
export * from "./payment-outbox";

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  videos: many(videos),
  stories: many(stories),
  playlists: many(playlists),
  sentTips: many(tipsLedger, { relationName: "sender" }),
  receivedTips: many(tipsLedger, { relationName: "creator" }),
  accessGrants: many(videoAccessGrants),
  payoutRequests: many(payoutRequests),
  invitations: many(userInvitations),
  sentMessages: many(directMessages, { relationName: "sender" }),
  receivedMessages: many(directMessages, { relationName: "recipient" }),
  blockedUsers: many(blockedUsers, { relationName: "blocker" }),
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
  comments: many(videoComments),
  likes: many(videoLikes),
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
  members: many(playlistMembers),
}));

export const playlistMembersRelations = relations(playlistMembers, ({ one }) => ({
  playlist: one(playlists, { fields: [playlistMembers.playlistId], references: [playlists.id] }),
  user: one(users, { fields: [playlistMembers.userId], references: [users.id] }),
}));

export const videoCommentsRelations = relations(videoComments, ({ one }) => ({
  video: one(videos, { fields: [videoComments.videoId], references: [videos.id] }),
  author: one(users, { fields: [videoComments.authorId], references: [users.id] }),
}));

export const videoLikesRelations = relations(videoLikes, ({ one }) => ({
  video: one(videos, { fields: [videoLikes.videoId], references: [videos.id] }),
  user: one(users, { fields: [videoLikes.userId], references: [users.id] }),
}));

export const videoViewsRelations = relations(videoViews, ({ one }) => ({
  video: one(videos, { fields: [videoViews.videoId], references: [videos.id] }),
}));

export const videoSharesRelations = relations(videoShares, ({ one }) => ({
  video: one(videos, { fields: [videoShares.videoId], references: [videos.id] }),
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

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, { fields: [follows.followerId], references: [users.id], relationName: "follower" }),
  creator: one(users, { fields: [follows.creatorId], references: [users.id], relationName: "followed" }),
}));

export const audienceListsRelations = relations(audienceLists, ({ one, many }) => ({
  owner: one(users, { fields: [audienceLists.ownerId], references: [users.id] }),
  members: many(audienceListMembers),
}));

export const audienceListMembersRelations = relations(audienceListMembers, ({ one }) => ({
  list: one(audienceLists, { fields: [audienceListMembers.listId], references: [audienceLists.id] }),
  user: one(users, { fields: [audienceListMembers.userId], references: [users.id] }),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  creator: one(users, {
    fields: [stories.creatorId],
    references: [users.id],
  }),
  views: many(storyViews),
  likes: many(storyLikes),
}));

export const storyViewsRelations = relations(storyViews, ({ one }) => ({
  story: one(stories, {
    fields: [storyViews.storyId],
    references: [stories.id],
  }),
  viewer: one(users, {
    fields: [storyViews.viewerId],
    references: [users.id],
  }),
}));

export const storyLikesRelations = relations(storyLikes, ({ one }) => ({
  story: one(stories, {
    fields: [storyLikes.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [storyLikes.userId],
    references: [users.id],
  }),
}));

export const contentRatingsRelations = relations(contentRatings, ({ many }) => ({
  videos: many(videos),
  stories: many(stories),
}));

export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  inviter: one(users, {
    fields: [userInvitations.inviterId],
    references: [users.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  participant1: one(users, {
    fields: [conversations.participant1Id],
    references: [users.id],
    relationName: "participant1",
  }),
  participant2: one(users, {
    fields: [conversations.participant2Id],
    references: [users.id],
    relationName: "participant2",
  }),
  messages: many(directMessages),
}));

export const directMessagesRelations = relations(directMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [directMessages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [directMessages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  recipient: one(users, {
    fields: [directMessages.recipientId],
    references: [users.id],
    relationName: "recipient",
  }),
}));

export const blockedUsersRelations = relations(blockedUsers, ({ one }) => ({
  blocker: one(users, {
    fields: [blockedUsers.blockerId],
    references: [users.id],
    relationName: "blocker",
  }),
  blocked: one(users, {
    fields: [blockedUsers.blockedId],
    references: [users.id],
    relationName: "blocked",
  }),
}));

