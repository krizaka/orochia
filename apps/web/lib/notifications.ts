import { db, follows, notifications, paymentIntents, profiles, users, videos } from "@orochia/db";
import { and, count, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import { conversationPath } from "./conversation-path";
import { appUrl } from "./env";
import { type I18nTools, type MessageKey, toolsFor } from "./i18n";
import { DEFAULT_LOCALE, isLocale, mailPath } from "./locales";
import { sendTemplate } from "./mail";
import { emitUserEvent } from "./messaging";
import { i18nVar, moneyVar } from "./notification-vars";
import { categoryOf, unsubscribable } from "./notification-matrix";
import type { NotificationEvent } from "./profile";
import { pushToUser } from "./push";
import { checkRateLimit } from "./rate-limit";
import { unsubscribeLink } from "./unsubscribe";

/**
 * Notifications. Each event is written to the account's notification list (the bell, /notifications), pushed live to
 * the open pages (SSE) and to the account's phones (push, lib/push.ts),
 * then e-mailed — every event is on by default, in the app and by e-mail, and each can be turned off on either side
 * (`profiles.in_app_off`, `profiles.notifications_off`). E-mail volume follows `profiles.email_frequency`: INSTANT,
 * HOURLY (at most one activity e-mail an hour; the rest wait in the bell) or NONE. Only verified, active addresses
 * receive e-mail. A notification never decides anything: it is written after the action, best-effort — `notify`
 * never throws. Bursts are capped (one e-mail per conversation and hour, one per creator and follower and day).
 */

type Vars = Record<string, string | number>;

async function recipient(userId: string) {
  const [row] = await db
    .select({
      email: users.email,
      username: users.username,
      verified: users.emailVerifiedAt,
      suspended: users.suspendedAt,
      emailsOff: profiles.emailsOff,
      inAppOff: profiles.inAppOff,
      frequency: profiles.emailFrequency,
      locale: users.locale,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row;
}

/** Whether this account wants this event on a channel, from that channel's "off" list (exported for tests). */
export function wants(off: unknown, event: NotificationEvent): boolean {
  return !(Array.isArray(off) && off.includes(event));
}

function localizeVars(tools: Pick<I18nTools, "t" | "money">, vars: Vars): Vars {
  const out: Vars = {};
  for (const [name, value] of Object.entries(vars)) {
    if (typeof value === "string" && value.startsWith("i18n:")) out[name] = tools.t(value.slice(5) as MessageKey);
    else if (typeof value === "string" && /^money:\d+$/.test(value)) out[name] = tools.money(Number(value.slice(6)));
    else out[name] = value;
  }
  return out;
}

/** The text of a notification, for the bell and the e-mail, in the language of `tools`. */
export function notificationText(tools: Pick<I18nTools, "t" | "money">, event: string, vars: Vars): string {
  return tools.t(`notify.${event}.body` as MessageKey, localizeVars(tools, vars));
}



/** Claims the right to send an activity e-mail now, under the account's frequency (atomic across instances). */
async function claimEmail(userId: string, frequency: string | null): Promise<boolean> {
  if (frequency === "NONE") return false;
  const window = frequency === "HOURLY" ? sql`now() - interval '1 hour'` : sql`now() - interval '0 seconds'`;
  const rows = await db
    .update(profiles)
    .set({ lastActivityEmailAt: new Date() })
    .where(and(eq(profiles.userId, userId), sql`(${profiles.lastActivityEmailAt} is null or ${profiles.lastActivityEmailAt} <= ${window})`))
    .returning({ id: profiles.id });
  return rows.length > 0 || frequency !== "HOURLY";
}

/** Records one notification (if wanted in the app), pushes it live, and e-mails it (if wanted, at the chosen pace). */
export async function notify(input: { userId: string; event: NotificationEvent; vars: Vars; path: string; actorId?: string | null; emailThrottleKey?: string; push?: boolean }): Promise<void> {
  const { userId, event, vars, path } = input;
  try {
    const to = await recipient(userId);
    if (!to || to.suspended) return;
    // Written when it leaves the server (live, push, e-mail) in the recipient's own language; the bell, in the page's.
    const tools = toolsFor(isLocale(to.locale) ? to.locale : DEFAULT_LOCALE);
    if (wants(to.inAppOff, event)) {
      const [row] = await db.insert(notifications).values({ userId, event, actorId: input.actorId ?? null, vars, path }).returning();
      emitUserEvent(userId, { type: "notification", notification: { id: row.id, event, text: notificationText(tools, event, vars), path, createdAt: row.createdAt, readAt: null } });
      // The same notification on the account's phones (when it has the app), in the background.
      if (input.push !== false) void pushToUser(userId, { title: tools.t(`notify.${event}.subject` as MessageKey, { ...localizeVars(tools, vars), username: to.username }), body: notificationText(tools, event, vars), path });
    }
    if (!to.verified || !wants(to.emailsOff, event)) return;
    if (input.emailThrottleKey) {
      const window = event === "newMessage" ? 3600 : 86400;
      if (!(await checkRateLimit(`notify:${event}:${userId}:${input.emailThrottleKey}`, 1, window)).success) return;
    }
    if (!(await claimEmail(userId, to.frequency))) return;
    const all = { ...localizeVars(tools, vars), username: to.username };
    // One click to stop this kind of e-mail (the security category has no such link), in the body and for mail clients.
    const category = categoryOf(event);
    const unsubscribe = unsubscribable(category) ? unsubscribeLink(userId, category) : null;
    await sendTemplate("notification", {
      to: to.email,
      locale: tools.locale,
      ...(unsubscribe ? { headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      vars: {
        username: to.username,
        subject: tools.t(`notify.${event}.subject` as MessageKey, all),
        body: tools.t(`notify.${event}.body` as MessageKey, all),
        link: `${appUrl()}${mailPath(path, tools.locale)}`,
        settingsLink: `${appUrl()}${mailPath("/me/settings#settings-notifications", tools.locale)}`,
        unsubscribeLink: unsubscribe ?? "",
      },
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
  return { name: row?.displayName || row?.username || "i18n:notify.someone", username: row?.username ?? "" };
}

// ── Events ──────────────────────────────────────────────────────────────────────────────────────

export async function notifyFollow(creatorId: string, followerId: string, pending: boolean) {
  const who = await nameOf(followerId);
  await notify({ userId: creatorId, actorId: followerId, event: "newFollower", vars: { name: who.name, action: i18nVar(pending ? "notify.newFollower.asks" : "notify.newFollower.follows") }, path: pending ? "/me/network" : `/@${who.username}` });
}

export async function notifyContactRequest(targetId: string, requesterId: string) {
  const who = await nameOf(requesterId);
  await notify({ userId: targetId, actorId: requesterId, event: "contactRequest", vars: { name: who.name }, path: "/me/network" });
}

export async function notifyComment(input: { videoId: string; authorId: string; parentAuthorId: string | null }) {
  const [video] = await db.select({ title: videos.title, creatorId: videos.creatorId }).from(videos).where(eq(videos.id, input.videoId)).limit(1);
  if (!video) return;
  const who = await nameOf(input.authorId);
  const path = `/watch/${input.videoId}#comments-title`;
  if (video.creatorId !== input.authorId) await notify({ userId: video.creatorId, actorId: input.authorId, event: "newComment", vars: { name: who.name, title: video.title }, path });
  if (input.parentAuthorId && input.parentAuthorId !== input.authorId && input.parentAuthorId !== video.creatorId) {
    await notify({ userId: input.parentAuthorId, actorId: input.authorId, event: "commentReply", vars: { name: who.name, title: video.title }, path });
  }
}

/**
 * A message arrived. The phone rings only when no Orochia screen of the recipient is in front of them (presence
 * `online`): an open page or app already shows it live.
 */
export async function notifyMessage(recipientId: string, senderId: string, conversationId: string) {
  const who = await nameOf(senderId);
  const { isOnline } = await import("./presence");
  const onScreen = await isOnline(recipientId).catch(() => false);
  await notify({ userId: recipientId, actorId: senderId, event: "newMessage", vars: { name: who.name }, path: conversationPath(conversationId), emailThrottleKey: conversationId, push: !onScreen });
}

/** After a settlement: the creator hears about the tip or the unlock (never about their own payments). */
export async function notifySettlement(intentId: string, unlocked: boolean) {
  const [intent] = await db
    .select({ creatorId: paymentIntents.creatorId, senderId: paymentIntents.senderId, videoId: paymentIntents.videoId, amountCents: paymentIntents.amountCents })
    .from(paymentIntents)
    .where(eq(paymentIntents.id, intentId))
    .limit(1);
  if (!intent || intent.senderId === intent.creatorId) return;
  const who = intent.senderId ? await nameOf(intent.senderId) : { name: i18nVar("notify.someone"), username: "" };
  const [video] = intent.videoId ? await db.select({ title: videos.title }).from(videos).where(eq(videos.id, intent.videoId)).limit(1) : [];
  const vars = { name: who.name, amount: moneyVar(intent.amountCents), title: video?.title ?? "" };
  await notify({ userId: intent.creatorId, actorId: intent.senderId, event: unlocked ? "videoUnlocked" : "tipReceived", vars, path: "/me/transactions" });
}

/** A video is online: its creator is told, and — when it is listed — the creator's approved followers. */
export async function notifyVideoReady(videoId: string) {
  const [video] = await db
    .select({ title: videos.title, creatorId: videos.creatorId, visibility: videos.visibility })
    .from(videos)
    .where(and(eq(videos.id, videoId), isNull(videos.removedAt)))
    .limit(1);
  if (!video) return;
  await notify({ userId: video.creatorId, event: "videoReady", vars: { title: video.title }, path: `/watch/${videoId}` });
  if (video.visibility === "INVITED_ONLY" || video.visibility === "CONTACTS_ONLY") return;
  const creator = await nameOf(video.creatorId);
  const followers = await db
    .select({ id: follows.followerId })
    .from(follows)
    .where(and(eq(follows.creatorId, video.creatorId), eq(follows.status, "APPROVED")));
  for (const f of followers) {
    await notify({ userId: f.id, actorId: video.creatorId, event: "creatorPublished", vars: { name: creator.name, title: video.title }, path: `/watch/${videoId}`, emailThrottleKey: video.creatorId });
  }
}

// ── The bell ────────────────────────────────────────────────────────────────────────────────────

export interface NotificationView {
  id: string;
  event: string;
  text: string;
  path: string;
  actorAvatar: string | null;
  createdAt: Date;
  readAt: Date | null;
}

/** An account's notifications, newest first (25 per page, `before` = the last one's date), and the unread count. */
export async function listNotifications(userId: string, tools: Pick<I18nTools, "t" | "money">, before?: Date): Promise<{ items: NotificationView[]; unread: number }> {
  const rows = await db
    .select({ n: notifications, avatar: profiles.avatarUrl })
    .from(notifications)
    .leftJoin(profiles, eq(profiles.userId, notifications.actorId))
    .where(and(eq(notifications.userId, userId), before ? lt(notifications.createdAt, before) : undefined))
    .orderBy(desc(notifications.createdAt))
    .limit(25);
  const [{ unread }] = await db.select({ unread: count() }).from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return {
    unread,
    items: rows.map(({ n, avatar }) => ({ id: n.id, event: n.event, text: notificationText(tools, n.event, n.vars), path: n.path, actorAvatar: avatar, createdAt: n.createdAt, readAt: n.readAt })),
  };
}

/** Marks some (or all) of an account's notifications read; ownership is in the query. */
export async function markNotificationsRead(userId: string, ids: string[] | "all"): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), ids === "all" ? undefined : inArray(notifications.id, ids)));
}
