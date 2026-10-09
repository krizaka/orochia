import { db, challenges, challengePledges, challengeApplications, follows, profiles, stories, users, videos } from "@orochia/db";
import { and, asc, desc, eq, gt, inArray, isNull, ne, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  CHALLENGE_MIN_PLEDGE_CENTS,
  CHALLENGE_SUGGESTED_PLEDGES_CENTS,
  ChallengeError,
  activeChallengeIdsFor,
  cancelChallenge,
  challengeProgress,
  challengeStage,
  closeChallenge,
  getWalletBalanceCents,
  type ChallengeCloseOutcome,
  type ChallengeRow,
  type ChallengeStage,
} from "@orochia/payments";
import { HttpError } from "./http";
import { t } from "./i18n";
import { signMediaUrl } from "./media-urls";
import { notify } from "./notifications";
import { publish } from "./realtime";

/**
 * Challenges in the web app: read models, the real-time feed and the notifications. The rules and the money are in
 * packages/payments (challenge-rules.ts, challenges.ts); routes call this module, never the database directly.
 *
 * Privacy: backers are shown under a per-challenge alias ("Backer 3", by order of first pledge) — a viewer sees "You"
 * for their own pledges. The fan who sent a request or posted an open call is a backer like the others in public; only
 * the creator dared by a request sees who sent it. Creators (a goal's, a request's, the applicants) are public.
 */

export const challengeTopic = (id: string) => `challenge:${id}`;

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export interface PersonView {
  username: string;
  name: string;
  avatarUrl: string | null;
}

export interface ChallengeCardView {
  id: string;
  kind: ChallengeRow["kind"];
  stage: ChallengeStage;
  deliverable: ChallengeRow["deliverable"];
  reward: ChallengeRow["reward"];
  title: string;
  goalCents: number | null;
  pledgedCents: number;
  backersCount: number;
  progress: number | null;
  deadline: string;
  deliveryDeadline: string | null;
  /** The creator who makes it (null for an open call nobody has taken yet). */
  creator: PersonView | null;
  applicationsCount: number;
}

export interface ChallengeView extends ChallengeCardView {
  description: string;
  deliveryDays: number;
  serverNow: string;
  recentPledges: {
    id: string;
    alias: number;
    amountCents: number;
    mine: boolean;
    createdAt: string;
  }[];
  /** The leaderboard: backers by total pledged (aliases). */
  topBackers: { alias: number; totalCents: number; mine: boolean }[];
  /** For the author of an open call: every application. For an applicant: theirs. Others: none (the count is public). */
  applications: {
    id: string;
    creator: PersonView;
    note: string | null;
    status: string;
    mine: boolean;
  }[];
  /** Who sent a request — for the creator it was sent to only. */
  requestedBy: PersonView | null;
  delivered: {
    videoId: string | null;
    storyId: string | null;
    canWatch: boolean;
  } | null;
  suggestedPledgesCents: number[];
  minimumPledgeCents: number;
  viewer: {
    signedIn: boolean;
    isAuthor: boolean;
    isCreator: boolean;
    alias: number | null;
    pledgedCents: number;
    balanceCents: number | null;
    canPledge: boolean;
    canApply: boolean;
    canAnswer: boolean;
    canStart: boolean;
    canAssign: boolean;
    canDeliver: boolean;
    canCancel: boolean;
  };
}

const creatorUser = alias(users, "creator_user");
const creatorProfile = alias(profiles, "creator_profile");

function person(row: { username: string | null; name: string | null; avatar: string | null }): PersonView | null {
  if (!row.username) return null;
  return {
    username: row.username,
    name: row.name || row.username,
    avatarUrl: signMediaUrl(row.avatar),
  };
}

async function personById(userId: string): Promise<PersonView | null> {
  const [row] = await db
    .select({
      username: users.username,
      name: profiles.displayName,
      avatar: profiles.avatarUrl,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  return row ? person(row) : null;
}

/** A backer's alias in a challenge: their rank by first pledge (1 = the first to pledge). */
async function aliases(challengeId: string): Promise<Map<string, number>> {
  const rows = await db
    .select({ backerId: challengePledges.backerId })
    .from(challengePledges)
    .where(eq(challengePledges.challengeId, challengeId))
    .groupBy(challengePledges.backerId)
    .orderBy(sql`min(${challengePledges.createdAt})`);
  return new Map(rows.map((r, i) => [r.backerId, i + 1]));
}

/** A challenge past its deadline is settled on the spot by whoever reads it first (the scheduler does it otherwise). */
async function settleIfDue(row: ChallengeRow, now: Date): Promise<ChallengeRow> {
  const due = (row.status === "OPEN" && row.deadline <= now) || (row.status === "ACCEPTED" && row.deliveryDeadline && row.deliveryDeadline < now);
  if (!due) return row;
  await announceClose(await closeChallenge(row.id, now));
  const [fresh] = await db.select().from(challenges).where(eq(challenges.id, row.id)).limit(1);
  return fresh ?? row;
}

function card(row: ChallengeRow, creator: PersonView | null, applicationsCount: number, now: Date): ChallengeCardView {
  return {
    id: row.id,
    kind: row.kind,
    stage: challengeStage(row, now),
    deliverable: row.deliverable,
    reward: row.reward,
    title: row.title,
    goalCents: row.goalCents,
    pledgedCents: row.pledgedCents,
    backersCount: row.backersCount,
    progress: challengeProgress(row),
    deadline: row.deadline.toISOString(),
    deliveryDeadline: row.deliveryDeadline?.toISOString() ?? null,
    creator,
    applicationsCount,
  };
}

/** The challenge as a viewer sees it, or null when it does not exist (or its people were suspended). */
export async function challengeView(challengeId: string, viewer: { id: string; role: string } | null): Promise<ChallengeView | null> {
  const now = new Date();
  const [found] = await db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  if (!found) return null;
  const row = await settleIfDue(found, now);
  const viewerId = viewer?.id ?? null;
  const isAuthor = viewerId === row.authorId;
  const isCreator = Boolean(viewerId) && viewerId === row.creatorId;

  const people = await db
    .select({ id: users.id, suspendedAt: users.suspendedAt })
    .from(users)
    .where(inArray(users.id, [row.authorId, ...(row.creatorId ? [row.creatorId] : [])]));
  if (people.some((p) => p.suspendedAt) && !isAuthor && !isCreator) return null;

  const [alias, pledges, totals, applications, creator, requester, balance, mine] = await Promise.all([
    aliases(row.id),
    db.select().from(challengePledges).where(eq(challengePledges.challengeId, row.id)).orderBy(desc(challengePledges.createdAt)).limit(12),
    db
      .select({
        backerId: challengePledges.backerId,
        total: sql<string>`sum(${challengePledges.amountCents})`,
      })
      .from(challengePledges)
      .where(and(eq(challengePledges.challengeId, row.id), ne(challengePledges.status, "RELEASED")))
      .groupBy(challengePledges.backerId)
      .orderBy(desc(sql`sum(${challengePledges.amountCents})`))
      .limit(5),
    row.kind === "OPEN_CALL"
      ? db
          .select({
            id: challengeApplications.id,
            creatorId: challengeApplications.creatorId,
            note: challengeApplications.note,
            status: challengeApplications.status,
            username: users.username,
            name: profiles.displayName,
            avatar: profiles.avatarUrl,
          })
          .from(challengeApplications)
          .innerJoin(users, eq(users.id, challengeApplications.creatorId))
          .leftJoin(profiles, eq(profiles.userId, users.id))
          .where(and(eq(challengeApplications.challengeId, row.id), isNull(users.suspendedAt)))
          .orderBy(asc(challengeApplications.createdAt))
      : Promise.resolve([]),
    row.creatorId ? personById(row.creatorId) : Promise.resolve(null),
    isCreator && row.kind === "REQUEST" ? personById(row.authorId) : Promise.resolve(null),
    viewerId && !isCreator ? getWalletBalanceCents(viewerId) : Promise.resolve(null),
    viewerId
      ? db
          .select({
            total: sql<string>`coalesce(sum(${challengePledges.amountCents}), 0)`,
          })
          .from(challengePledges)
          .where(and(eq(challengePledges.challengeId, row.id), eq(challengePledges.backerId, viewerId), ne(challengePledges.status, "RELEASED")))
      : Promise.resolve([{ total: "0" }]),
  ]);

  const open = row.status === "OPEN" && now < row.deadline;
  const pledgedCents = Number(mine[0]?.total ?? 0);
  const applied = applications.find((a) => a.creatorId === viewerId);
  const isActiveCreator =
    viewer?.role === "CREATOR" && (await db.select({ ok: users.isVerified }).from(users).where(eq(users.id, viewer.id)).limit(1))[0]?.ok === true;
  let delivered: ChallengeView["delivered"] = null;
  if (row.status === "DELIVERED") {
    const backersOnly = row.reward === "BACKERS";
    const paid = viewerId
      ? (
          await db
            .select({ id: challengePledges.id })
            .from(challengePledges)
            .where(and(eq(challengePledges.challengeId, row.id), eq(challengePledges.backerId, viewerId), eq(challengePledges.status, "PAID")))
            .limit(1)
        ).length > 0
      : false;
    delivered = {
      videoId: row.deliveredVideoId,
      storyId: row.deliveredStoryId,
      canWatch: !backersOnly || paid || isCreator,
    };
  }

  return {
    ...card(row, creator, applications.length, now),
    description: row.description,
    deliveryDays: row.deliveryDays,
    serverNow: now.toISOString(),
    recentPledges: pledges
      .filter((p) => p.status !== "RELEASED")
      .map((p) => ({
        id: p.id,
        alias: alias.get(p.backerId) ?? 0,
        amountCents: p.amountCents,
        mine: p.backerId === viewerId,
        createdAt: p.createdAt.toISOString(),
      })),
    topBackers: totals.map((b) => ({
      alias: alias.get(b.backerId) ?? 0,
      totalCents: Number(b.total),
      mine: b.backerId === viewerId,
    })),
    applications: applications
      .filter((a) => isAuthor || a.creatorId === viewerId || a.status === "CHOSEN")
      .map((a) => ({
        id: a.id,
        creator: person(a)!,
        note: isAuthor || a.creatorId === viewerId ? a.note : null,
        status: a.status,
        mine: a.creatorId === viewerId,
      })),
    requestedBy: requester,
    delivered,
    suggestedPledgesCents: [...CHALLENGE_SUGGESTED_PLEDGES_CENTS],
    minimumPledgeCents: CHALLENGE_MIN_PLEDGE_CENTS,
    viewer: {
      signedIn: Boolean(viewerId),
      isAuthor,
      isCreator,
      alias: viewerId ? (alias.get(viewerId) ?? null) : null,
      pledgedCents,
      balanceCents: balance,
      canPledge: open && Boolean(viewerId) && !isCreator && !applied,
      canApply: open && row.kind === "OPEN_CALL" && Boolean(isActiveCreator) && !isAuthor && !applied && pledgedCents === 0,
      canAnswer: open && row.kind === "REQUEST" && isCreator,
      canStart: row.status === "OPEN" && row.kind === "GOAL" && isCreator && (challengeProgress(row) ?? 0) >= 1,
      canAssign: open && row.kind === "OPEN_CALL" && isAuthor,
      canDeliver: row.status === "ACCEPTED" && isCreator,
      canCancel: row.status === "OPEN" && isAuthor,
    },
  };
}

// ── Lists ─────────────────────────────────────────────────────────────────────────────────────

/** Tabs of the challenges page — each one is a URL (`/challenges?tab=…`). */
export const CHALLENGE_TABS = ["open", "calls", "done", "inbox", "mine", "backing"] as const;
export type ChallengeTab = (typeof CHALLENGE_TABS)[number];
export const PERSONAL_CHALLENGE_TABS: readonly ChallengeTab[] = ["inbox", "mine", "backing"];

/**
 * A tab of the challenges page. open — everything taking pledges, ending soonest first; calls — open calls creators can
 * take; done — delivered recently; inbox — a creator's requests to answer and challenges to deliver; mine — what the
 * viewer wrote; backing — what the viewer pledged on.
 */
export async function listChallenges(tab: ChallengeTab, viewerId: string | null, limit = 24): Promise<ChallengeCardView[]> {
  const now = new Date();
  let where: SQL | undefined;
  let order: SQL[] = [asc(challenges.deadline)];
  switch (tab) {
    case "open":
      where = and(eq(challenges.status, "OPEN"), gt(challenges.deadline, now));
      break;
    case "calls":
      where = and(eq(challenges.status, "OPEN"), eq(challenges.kind, "OPEN_CALL"), gt(challenges.deadline, now));
      break;
    case "done":
      where = eq(challenges.status, "DELIVERED");
      order = [desc(challenges.deliveredAt)];
      break;
    case "inbox":
      if (!viewerId) return [];
      where = and(eq(challenges.creatorId, viewerId), inArray(challenges.status, ["OPEN", "ACCEPTED"]), ne(challenges.authorId, viewerId));
      break;
    case "mine":
      if (!viewerId) return [];
      where = eq(challenges.authorId, viewerId);
      order = [desc(challenges.createdAt)];
      break;
    case "backing":
      if (!viewerId) return [];
      where = sql`exists (select 1 from challenge_pledges p where p.challenge_id = ${challenges.id} and p.backer_id = ${viewerId})`;
      order = [sql`case when ${challenges.status} in ('OPEN', 'ACCEPTED') then 0 else 1 end`, desc(challenges.updatedAt)];
      break;
  }
  const author = alias(users, "author_user");
  const rows = await db
    .select({
      c: challenges,
      username: creatorUser.username,
      name: creatorProfile.displayName,
      avatar: creatorProfile.avatarUrl,
      applications: sql<string>`(select count(*) from challenge_applications a where a.challenge_id = ${challenges.id})`,
    })
    .from(challenges)
    .innerJoin(author, eq(author.id, challenges.authorId))
    .leftJoin(creatorUser, eq(creatorUser.id, challenges.creatorId))
    .leftJoin(creatorProfile, eq(creatorProfile.userId, challenges.creatorId))
    .where(and(where, PERSONAL_CHALLENGE_TABS.includes(tab) ? undefined : and(isNull(author.suspendedAt), isNull(creatorUser.suspendedAt))))
    .orderBy(...order)
    .limit(limit);
  return rows.map((r) => card(r.c, person(r), Number(r.applications), now));
}

/** What a creator can deliver for a challenge: their ready videos not in use, or stories posted since they committed. */
export async function deliveryOptions(challengeId: string, creatorId: string) {
  const [row] = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.creatorId, creatorId), eq(challenges.status, "ACCEPTED")))
    .limit(1);
  if (!row) throw new HttpError(404, t("challenge.errors.NOT_FOUND"));
  if (row.deliverable === "VIDEO") {
    const items = await db
      .select({
        id: videos.id,
        title: videos.title,
        thumbnailUrl: videos.thumbnailUrl,
      })
      .from(videos)
      .where(
        and(
          eq(videos.creatorId, creatorId),
          eq(videos.status, "READY"),
          isNull(videos.removedAt),
          sql`${videos.visibility} not in ('AUCTION', 'CHALLENGE')`,
          sql`not exists (select 1 from challenges c where c.delivered_video_id = ${videos.id})`,
        ),
      )
      .orderBy(desc(videos.createdAt))
      .limit(50);
    return {
      deliverable: "VIDEO" as const,
      items: items.map((v) => ({
        ...v,
        thumbnailUrl: signMediaUrl(v.thumbnailUrl),
      })),
    };
  }
  const items = await db
    .select({
      id: stories.id,
      title: stories.caption,
      thumbnailUrl: stories.thumbnailUrl,
    })
    .from(stories)
    .where(
      and(
        eq(stories.creatorId, creatorId),
        eq(stories.status, "READY"),
        isNull(stories.removedAt),
        gt(stories.expiresAt, new Date()),
        gt(stories.createdAt, row.acceptedAt ?? new Date(0)),
      ),
    )
    .orderBy(desc(stories.createdAt))
    .limit(50);
  return {
    deliverable: "STORY" as const,
    items: items.map((s) => ({
      ...s,
      title: s.title ?? "",
      thumbnailUrl: signMediaUrl(s.thumbnailUrl),
    })),
  };
}

// ── Real-time feed and notifications ──────────────────────────────────────────────────────────

async function backersOf(challengeId: string, statuses: ("HELD" | "PAID" | "RELEASED")[]): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: challengePledges.backerId })
    .from(challengePledges)
    .where(and(eq(challengePledges.challengeId, challengeId), inArray(challengePledges.status, statuses)));
  return rows.map((r) => r.id);
}

const path = (c: ChallengeRow) => `/challenges/${c.id}`;

/** Everyone watching receives the pledge (alias only); the creator — or the author of an open call — hears of it. */
export async function announcePledge(input: {
  challenge: ChallengeRow;
  pledgeId: string;
  backerId: string;
  amountCents: number;
  createdAt: Date;
  reachedGoal: boolean;
}) {
  const { challenge } = input;
  const backer = (await aliases(challenge.id)).get(input.backerId) ?? 0;
  await publish(challengeTopic(challenge.id), {
    type: "pledge",
    pledge: {
      id: input.pledgeId,
      alias: backer,
      amountCents: input.amountCents,
      createdAt: input.createdAt.toISOString(),
    },
    pledgedCents: challenge.pledgedCents,
    backersCount: challenge.backersCount,
    progress: challengeProgress(challenge),
  });
  return backer;
}

export async function notifyPledge(input: { challenge: ChallengeRow; backerId: string; amountCents: number; reachedGoal: boolean }) {
  const { challenge } = input;
  const vars = {
    title: challenge.title,
    amount: money(input.amountCents),
    total: money(challenge.pledgedCents),
  };
  const owner = challenge.kind === "OPEN_CALL" ? challenge.authorId : challenge.creatorId;
  if (owner && owner !== input.backerId)
    await notify({
      userId: owner,
      event: "challengePledged",
      vars,
      path: path(challenge),
      emailThrottleKey: challenge.id,
    });
  if (input.reachedGoal && challenge.creatorId) {
    await notify({
      userId: challenge.creatorId,
      event: "challengeFunded",
      vars: { ...vars, days: challenge.deliveryDays },
      path: path(challenge),
    });
  }
}

/** A new challenge: a request reaches its creator; a goal reaches the creator's approved followers (once a day). */
export async function notifyCreated(challenge: ChallengeRow) {
  const vars = {
    title: challenge.title,
    amount: money(challenge.pledgedCents),
  };
  if (challenge.kind === "REQUEST" && challenge.creatorId) {
    await notify({
      userId: challenge.creatorId,
      actorId: challenge.authorId,
      event: "challengeRequested",
      vars,
      path: path(challenge),
    });
  }
  if (challenge.kind === "GOAL" && challenge.creatorId) {
    const creator = await personById(challenge.creatorId);
    const followers = await db
      .select({ id: follows.followerId })
      .from(follows)
      .where(and(eq(follows.creatorId, challenge.creatorId), eq(follows.status, "APPROVED")));
    for (const f of followers) {
      await notify({
        userId: f.id,
        actorId: challenge.creatorId,
        event: "challengeAnnounced",
        vars: { ...vars, name: creator?.name ?? "" },
        path: path(challenge),
        emailThrottleKey: challenge.creatorId,
      });
    }
  }
}

/** A creator applied to an open call: its author hears of it. */
export async function notifyApplied(challenge: ChallengeRow, creatorId: string) {
  const creator = await personById(creatorId);
  await notify({
    userId: challenge.authorId,
    actorId: creatorId,
    event: "challengeApplied",
    vars: { title: challenge.title, name: creator?.name ?? "" },
    path: path(challenge),
    emailThrottleKey: challenge.id,
  });
}

/** A creator committed (request accepted, goal started or funded, applicant picked): backers and the creator are told. */
export async function announceAccepted(challenge: ChallengeRow, how: "accepted" | "funded" | "chosen", notChosen: string[] = []) {
  await publish(challengeTopic(challenge.id), {
    type: "state",
    status: challenge.status,
  });
  const creator = challenge.creatorId ? await personById(challenge.creatorId) : null;
  const vars = {
    title: challenge.title,
    name: creator?.name ?? "",
    days: challenge.deliveryDays,
    total: money(challenge.pledgedCents),
  };
  for (const backer of await backersOf(challenge.id, ["HELD"])) {
    if (backer !== challenge.creatorId)
      await notify({
        userId: backer,
        event: "challengeAccepted",
        vars,
        path: path(challenge),
      });
  }
  if (challenge.creatorId && how === "funded")
    await notify({
      userId: challenge.creatorId,
      event: "challengeFunded",
      vars,
      path: path(challenge),
    });
  if (challenge.creatorId && how === "chosen")
    await notify({
      userId: challenge.creatorId,
      event: "challengeChosen",
      vars,
      path: path(challenge),
    });
  for (const creatorId of notChosen) {
    await notify({
      userId: creatorId,
      event: "challengeClosed",
      vars: {
        title: challenge.title,
        reason: t("challenge.release.NOT_CHOSEN"),
      },
      path: path(challenge),
    });
  }
}

/** Delivered: backers can watch, and everyone watching reloads. */
export async function announceDelivered(challenge: ChallengeRow, paidBackers: string[]) {
  await publish(challengeTopic(challenge.id), {
    type: "state",
    status: challenge.status,
  });
  for (const backer of paidBackers) {
    await notify({
      userId: backer,
      event: "challengeDelivered",
      vars: { title: challenge.title },
      path: path(challenge),
    });
  }
}

/** A challenge that will not happen: every backer whose credits came back is told why. */
export async function announceReleased(challenge: ChallengeRow, releasedTo: string[]) {
  await publish(challengeTopic(challenge.id), {
    type: "state",
    status: challenge.status,
  });
  const reason = t(`challenge.release.${challenge.status as "DECLINED" | "EXPIRED" | "FAILED" | "CANCELLED"}`);
  for (const backer of releasedTo) {
    const [total] = await db
      .select({
        cents: sql<string>`coalesce(sum(${challengePledges.amountCents}), 0)`,
      })
      .from(challengePledges)
      .where(and(eq(challengePledges.challengeId, challenge.id), eq(challengePledges.backerId, backer), eq(challengePledges.status, "RELEASED")));
    await notify({
      userId: backer,
      event: "challengeReleased",
      vars: {
        title: challenge.title,
        reason,
        amount: money(Number(total?.cents ?? 0)),
      },
      path: "/wallet",
    });
  }
}

export async function announceClose(outcome: ChallengeCloseOutcome) {
  if (outcome.kind === "NOOP") return;
  if (outcome.kind === "FUNDED") return announceAccepted(outcome.challenge, "funded");
  await announceReleased(outcome.challenge, outcome.releasedTo);
  if (outcome.kind === "FAILED" && outcome.challenge.creatorId) {
    await notify({
      userId: outcome.challenge.creatorId,
      event: "challengeClosed",
      vars: {
        title: outcome.challenge.title,
        reason: t("challenge.release.FAILED"),
      },
      path: path(outcome.challenge),
    });
  }
}

/** An operator stops the challenges an account wrote or must make (a suspension): every pledge comes back. */
export async function cancelChallengesByOperator(userId: string, reason: string): Promise<number> {
  const ids = await activeChallengeIdsFor(userId);
  for (const challengeId of ids) {
    const result = await cancelChallenge({
      challengeId,
      byOperator: true,
      reason,
    });
    await announceReleased(result.challenge, result.releasedTo);
  }
  return ids.length;
}

// ── Errors ────────────────────────────────────────────────────────────────────────────────────

/** An engine refusal as an HTTP answer: status, a plain message, and the details the UI shows (minimum, balance). */
export function challengeHttpError(error: unknown): { status: number; message: string; extra: Record<string, unknown> } | null {
  if (!(error instanceof ChallengeError)) return null;
  const status: Record<ChallengeError["code"], number> = {
    NOT_FOUND: 404,
    BAD_TITLE: 400,
    BAD_DESCRIPTION: 400,
    BAD_GOAL: 400,
    BAD_DEADLINE: 400,
    BAD_DELIVERY_DAYS: 400,
    BAD_AMOUNT: 400,
    NOT_A_CREATOR: 403,
    REQUESTS_OFF: 403,
    OFFER_TOO_LOW: 409,
    OWN_CHALLENGE: 403,
    NOT_OPEN: 409,
    INSUFFICIENT_CREDITS: 402,
    GOAL_NOT_REACHED: 409,
    NOT_ALLOWED: 403,
    ALREADY_APPLIED: 409,
    NOT_IN_PROGRESS: 409,
    BAD_DELIVERY: 409,
  };
  const extra: Record<string, unknown> = { code: error.code, ...error.details };
  if (error.code === "INSUFFICIENT_CREDITS") extra.topUpUrl = "/wallet";
  return {
    status: status[error.code],
    message: t(`challenge.errors.${error.code}`),
    extra,
  };
}

/** Throws an HttpError for a challenge id that is not a UUID (404, never 500). */
export function challengeIdOr404(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new HttpError(404, t("challenge.errors.NOT_FOUND"));
  return id;
}

/** The creator a request is sent to, by username (only active, verified creators can be dared). */
export async function creatorIdByUsername(username: string): Promise<string | null> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, username), eq(users.role, "CREATOR"), eq(users.isVerified, true), isNull(users.suspendedAt)))
    .limit(1);
  return row?.id ?? null;
}
