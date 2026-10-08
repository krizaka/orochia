import { db, follows, paymentIntents, profiles, users, videos } from "@orochia/db";
import { and, eq, isNull } from "drizzle-orm";
import { appUrl } from "./env";
import { t, type MessageKey } from "./i18n";
import { sendMail } from "./mail";
import { checkRateLimit } from "./rate-limit";
import type { NotificationEvent } from "./profile";

/**
 * Activity e-mails. Every event is on by default and each can be turned off in Settings
 * (`profiles.notifications_off`). Only verified, active addresses receive them. A notification never decides
 * anything: it is sent after the action is recorded, best-effort, and a failure is logged — `notify` never throws.
 * Bursts are capped (one e-mail per conversation and hour, one per creator and follower and day).
 */

type Vars = Record<string, string | number>;

async function recipient(userId: string) {
  const [row] = await db
    .select({
      email: users.email,
      username: users.username,
      verified: users.emailVerifiedAt,
      suspended: users.suspendedAt,
      off: profiles.notificationsOff,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

/** Whether this account wants this e-mail (exported for tests). */
export function wants(off: unknown, event: NotificationEvent): boolean {
  return !(Array.isArray(off) && off.includes(event));
}

/** Sends one activity e-mail if the account wants it. `path` is where the e-mail leads (on this site). */
export async function notify(userId: string, event: NotificationEvent, vars: Vars, path: string, throttleKey?: string): Promise<void> {
  try {
    const to = await recipient(userId);
    if (!to || !to.verified || to.suspended || !wants(to.off, event)) return;
    if (throttleKey) {
      const window = event === "newMessage" ? 3600 : 86400;
      if (!(await checkRateLimit(`notify:${event}:${userId}:${throttleKey}`, 1, window)).success) return;
    }
    const all = { ...vars, username: to.username };
    await sendMail({
      to: to.email,
      subject: `${t(`notify.${event}.subject` as MessageKey, all)} — Orochia`,
      text: [
        t("notify.greeting", all),
        "",
        t(`notify.${event}.body` as MessageKey, all),
        "",
        `${appUrl()}${path}`,
        "",
        t("notify.footer", { settings: `${appUrl()}/dashboard?tab=settings` }),
      ].join("\n"),
    });
  } catch (error) {
    console.error(`notify: ${event} to ${userId} failed`, error);
  }
}

async function nameOf(userId: string): Promise<{ name: string; username: string }> {
  const [row] = await db
    .select({ username: users.username, displayName: profiles.displayName })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return { name: row?.displayName || row?.username || "Someone", username: row?.username ?? "" };
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// ── Events ──────────────────────────────────────────────────────────────────────────────────────

export async function notifyFollow(creatorId: string, followerId: string, pending: boolean) {
  const who = await nameOf(followerId);
  await notify(creatorId, "newFollower", { name: who.name, action: t(pending ? "notify.newFollower.asks" : "notify.newFollower.follows") }, pending ? "/dashboard?tab=network" : `/creators/${who.username}`);
}

export async function notifyContactRequest(targetId: string, requesterId: string) {
  const who = await nameOf(requesterId);
  await notify(targetId, "contactRequest", { name: who.name }, "/dashboard?tab=network");
}

export async function notifyComment(input: { videoId: string; authorId: string; parentAuthorId: string | null }) {
  const [video] = await db.select({ title: videos.title, creatorId: videos.creatorId }).from(videos).where(eq(videos.id, input.videoId)).limit(1);
  if (!video) return;
  const who = await nameOf(input.authorId);
  const path = `/watch/${input.videoId}#comments-title`;
  if (video.creatorId !== input.authorId) await notify(video.creatorId, "newComment", { name: who.name, title: video.title }, path);
  if (input.parentAuthorId && input.parentAuthorId !== input.authorId && input.parentAuthorId !== video.creatorId) {
    await notify(input.parentAuthorId, "commentReply", { name: who.name, title: video.title }, path);
  }
}

export async function notifyMessage(recipientId: string, senderId: string, conversationId: string) {
  const who = await nameOf(senderId);
  await notify(recipientId, "newMessage", { name: who.name }, "/messages", conversationId);
}

/** After a settlement: the creator hears about the tip or the unlock (never about their own payments). */
export async function notifySettlement(intentId: string, unlocked: boolean) {
  const [intent] = await db
    .select({ creatorId: paymentIntents.creatorId, senderId: paymentIntents.senderId, videoId: paymentIntents.videoId, amountCents: paymentIntents.amountCents })
    .from(paymentIntents)
    .where(eq(paymentIntents.id, intentId))
    .limit(1);
  if (!intent || intent.senderId === intent.creatorId) return;
  const who = intent.senderId ? await nameOf(intent.senderId) : { name: "Someone", username: "" };
  const [video] = intent.videoId ? await db.select({ title: videos.title }).from(videos).where(eq(videos.id, intent.videoId)).limit(1) : [];
  const vars = { name: who.name, amount: money(intent.amountCents), title: video?.title ?? "" };
  await notify(intent.creatorId, unlocked ? "videoUnlocked" : "tipReceived", vars, "/dashboard?tab=ledger");
}

/** A video is online: its creator is told, and — when it is listed — the creator's approved followers. */
export async function notifyVideoReady(videoId: string) {
  const [video] = await db
    .select({ title: videos.title, creatorId: videos.creatorId, visibility: videos.visibility })
    .from(videos)
    .where(and(eq(videos.id, videoId), isNull(videos.removedAt)))
    .limit(1);
  if (!video) return;
  await notify(video.creatorId, "videoReady", { title: video.title }, `/watch/${videoId}`);
  if (video.visibility === "INVITED_ONLY" || video.visibility === "CONTACTS_ONLY") return;
  const creator = await nameOf(video.creatorId);
  const followers = await db
    .select({ id: follows.followerId })
    .from(follows)
    .where(and(eq(follows.creatorId, video.creatorId), eq(follows.status, "APPROVED")));
  for (const f of followers) {
    await notify(f.id, "creatorPublished", { name: creator.name, title: video.title }, `/watch/${videoId}`, video.creatorId);
  }
}
