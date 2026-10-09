import { db, challenges, challengePledges, challengeApplications, profiles, stories, users, videos, walletLedger } from "@orochia/db";
import { and, asc, eq, inArray, lte, ne, or, sql } from "drizzle-orm";
import { getWalletBalanceCents } from "./credits";
import { creditTip, type LedgerExecutor } from "./ledger";
import { checkChallengeDraft, deliveryDeadline, isValidPledge, CHALLENGE_MIN_PLEDGE_CENTS, type ChallengeKind, type DraftProblem } from "./challenge-rules";

/**
 * Challenges — the state machine and its money. Every transition runs in one transaction under the challenge's row
 * lock, so pledges, answers, picks, deliveries and closing serialise per challenge and nothing is decided twice.
 *
 * Money: a pledge holds the backer's credits (wallet_ledger HOLD `hold_cpl_<pledge>`, under the wallet's advisory lock,
 * the same one as every credit spend) until the challenge is delivered — then each pledge is released and spent
 * (`release_cpl_` / `spend_cpl_`) and the creator credited through the ledger like an unlock (CREATOR_CREDIT, gateway
 * CREDITS, reference `challenge_<pledge>`), with the backer's access grant when the delivery is a video. A challenge
 * that does not happen — declined, expired, failed, cancelled — releases every held pledge. Every reference is unique,
 * so a movement is written once whatever retries happen.
 */

export type ChallengeRow = typeof challenges.$inferSelect;
export type ChallengePledgeRow = typeof challengePledges.$inferSelect;

export type ChallengeErrorCode =
  | "NOT_FOUND"
  | DraftProblem
  | "NOT_A_CREATOR"
  | "REQUESTS_OFF"
  | "OFFER_TOO_LOW"
  | "OWN_CHALLENGE"
  | "NOT_OPEN"
  | "INSUFFICIENT_CREDITS"
  | "GOAL_NOT_REACHED"
  | "NOT_ALLOWED"
  | "ALREADY_APPLIED"
  | "NOT_IN_PROGRESS"
  | "BAD_DELIVERY";

/** A refused challenge action; `details` carries what the caller needs to explain it (minimum, balance…). */
export class ChallengeError extends Error {
  constructor(
    readonly code: ChallengeErrorCode,
    readonly details: Record<string, string | number> = {},
  ) {
    super(code);
    this.name = "ChallengeError";
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const walletLock = (tx: Tx, userId: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`wallet:${userId}`}))`);

async function lockChallenge(tx: Tx, challengeId: string, skipLocked = false): Promise<ChallengeRow | undefined> {
  const query = tx.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1);
  const [row] = await (skipLocked ? query.for("update", { skipLocked: true }) : query.for("update"));
  return row;
}

/** An active creator who may make challenges: CREATOR, 2257-verified, not suspended. */
async function activeCreator(tx: Tx, userId: string) {
  const [row] = await tx
    .select({
      id: users.id,
      role: users.role,
      verified: users.isVerified,
      suspendedAt: users.suspendedAt,
      requestsOff: profiles.challengeRequestsOff,
      minCents: profiles.challengeMinCents,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || row.role !== "CREATOR" || !row.verified || row.suspendedAt) return null;
  return row;
}

/** Holds a pledge's credits and records it; the caller holds the challenge's lock and has checked the challenge. */
async function holdPledge(tx: Tx, challenge: ChallengeRow, backerId: string, amountCents: number, now: Date) {
  await walletLock(tx, backerId);
  const balance = await getWalletBalanceCents(backerId, tx);
  if (balance < amountCents)
    throw new ChallengeError("INSUFFICIENT_CREDITS", {
      balance,
      minimum: amountCents,
    });
  const [already] = await tx
    .select({ id: challengePledges.id })
    .from(challengePledges)
    .where(and(eq(challengePledges.challengeId, challenge.id), eq(challengePledges.backerId, backerId), ne(challengePledges.status, "RELEASED")))
    .limit(1);
  const [pledge] = await tx.insert(challengePledges).values({ challengeId: challenge.id, backerId, amountCents }).returning();
  await tx.insert(walletLedger).values({
    userId: backerId,
    entryType: "HOLD",
    amountCents: -amountCents,
    reference: `hold_cpl_${pledge.id}`,
    note: "Challenge pledge",
  });
  const [updated] = await tx
    .update(challenges)
    .set({
      pledgedCents: sql`${challenges.pledgedCents} + ${amountCents}`,
      backersCount: already ? challenges.backersCount : sql`${challenges.backersCount} + 1`,
      updatedAt: now,
    })
    .where(eq(challenges.id, challenge.id))
    .returning();
  return { pledge, challenge: updated, balanceCents: balance - amountCents };
}

/** Gives back every held pledge of a challenge (once per pledge: the reference is unique); returns who got credits back. */
async function releaseAll(tx: Tx, challenge: ChallengeRow, note: string, now: Date): Promise<string[]> {
  const held = await tx
    .select()
    .from(challengePledges)
    .where(and(eq(challengePledges.challengeId, challenge.id), eq(challengePledges.status, "HELD")));
  if (held.length === 0) return [];
  await tx
    .update(challengePledges)
    .set({ status: "RELEASED", releasedAt: now })
    .where(
      inArray(
        challengePledges.id,
        held.map((p) => p.id),
      ),
    );
  await tx
    .insert(walletLedger)
    .values(
      held.map((p) => ({
        userId: p.backerId,
        entryType: "RELEASE" as const,
        amountCents: p.amountCents,
        reference: `release_cpl_${p.id}`,
        note,
      })),
    )
    .onConflictDoNothing();
  return [...new Set(held.map((p) => p.backerId))];
}

async function finish(
  tx: Tx,
  challenge: ChallengeRow,
  status: "DECLINED" | "EXPIRED" | "FAILED" | "CANCELLED",
  note: string,
  now: Date,
  cancelReason?: string,
) {
  const releasedTo = await releaseAll(tx, challenge, note, now);
  const [row] = await tx
    .update(challenges)
    .set({
      status,
      closedAt: now,
      updatedAt: now,
      cancelReason: cancelReason ?? null,
    })
    .where(eq(challenges.id, challenge.id))
    .returning();
  return { challenge: row, releasedTo };
}

async function commit(tx: Tx, challenge: ChallengeRow, now: Date, creatorId = challenge.creatorId) {
  const [row] = await tx
    .update(challenges)
    .set({
      status: "ACCEPTED",
      creatorId,
      acceptedAt: now,
      deliveryDeadline: deliveryDeadline(challenge.deliveryDays, now),
      updatedAt: now,
    })
    .where(eq(challenges.id, challenge.id))
    .returning();
  return row;
}

async function hasApplied(tx: Tx, challengeId: string, userId: string): Promise<boolean> {
  const [row] = await tx
    .select({ id: challengeApplications.id })
    .from(challengeApplications)
    .where(and(eq(challengeApplications.challengeId, challengeId), eq(challengeApplications.creatorId, userId)))
    .limit(1);
  return Boolean(row);
}

// ── Creating ──────────────────────────────────────────────────────────────────────────────────

export interface CreateChallengeInput {
  kind: ChallengeKind;
  authorId: string;
  title: string;
  description: string;
  deliverable: "VIDEO" | "STORY";
  deliveryDays: number;
  /** GOAL only: who watches the delivery. Requests and open calls are always for their backers. */
  reward?: "BACKERS" | "EVERYONE";
  goalCents?: number | null;
  deadline?: Date | null;
  /** REQUEST: the creator dared. */
  targetCreatorId?: string | null;
  /** REQUEST and OPEN_CALL: the author's own first pledge. */
  offerCents?: number | null;
}

/**
 * Opens a challenge. A goal is a creator's own; a request dares one creator (who accepts them and above their minimum)
 * and holds the author's offer at once; an open call holds the author's pot and waits for applications.
 */
export async function createChallenge(input: CreateChallengeInput, now = new Date()): Promise<{ challenge: ChallengeRow; balanceCents: number | null }> {
  const draft = checkChallengeDraft(input, now);
  if (!draft.ok) throw new ChallengeError(draft.problem);

  return db.transaction(async (tx) => {
    let creatorId: string | null = null;
    if (input.kind === "GOAL") {
      if (!(await activeCreator(tx, input.authorId))) throw new ChallengeError("NOT_A_CREATOR");
      creatorId = input.authorId;
    } else if (input.kind === "REQUEST") {
      if (!input.targetCreatorId) throw new ChallengeError("NOT_FOUND");
      if (input.targetCreatorId === input.authorId) throw new ChallengeError("OWN_CHALLENGE");
      const target = await activeCreator(tx, input.targetCreatorId);
      if (!target) throw new ChallengeError("NOT_A_CREATOR");
      if (target.requestsOff) throw new ChallengeError("REQUESTS_OFF");
      const minimum = Math.max(target.minCents ?? 0, CHALLENGE_MIN_PLEDGE_CENTS);
      if ((input.offerCents ?? 0) < minimum) throw new ChallengeError("OFFER_TOO_LOW", { minimum });
      creatorId = target.id;
    }

    const [challenge] = await tx
      .insert(challenges)
      .values({
        kind: input.kind,
        authorId: input.authorId,
        creatorId,
        title: input.title.trim(),
        description: input.description.trim(),
        deliverable: input.deliverable,
        reward: input.kind === "GOAL" ? (input.reward ?? "BACKERS") : "BACKERS",
        goalCents: input.kind === "GOAL" ? input.goalCents : null,
        deadline: draft.deadline,
        deliveryDays: input.deliveryDays,
      })
      .returning();
    if (input.kind === "GOAL") return { challenge, balanceCents: null };
    const held = await holdPledge(tx, challenge, input.authorId, input.offerCents ?? 0, now);
    return { challenge: held.challenge, balanceCents: held.balanceCents };
  });
}

// ── Pledging ──────────────────────────────────────────────────────────────────────────────────

export interface PledgeOutcome {
  challenge: ChallengeRow;
  pledge: ChallengePledgeRow;
  /** This pledge carried a goal past its target. */
  reachedGoal: boolean;
  balanceCents: number;
}

/** Adds credits to an open challenge. Nobody pledges on a challenge they would be paid for. */
export async function pledgeChallenge(input: { challengeId: string; backerId: string; amountCents: number }, now = new Date()): Promise<PledgeOutcome> {
  if (!isValidPledge(input.amountCents))
    throw new ChallengeError("BAD_AMOUNT", {
      minimum: CHALLENGE_MIN_PLEDGE_CENTS,
    });
  return db.transaction(async (tx) => {
    const challenge = await lockChallenge(tx, input.challengeId);
    if (!challenge) throw new ChallengeError("NOT_FOUND");
    if (challenge.status !== "OPEN" || now >= challenge.deadline) throw new ChallengeError("NOT_OPEN");
    if (challenge.creatorId === input.backerId) throw new ChallengeError("OWN_CHALLENGE");
    if (challenge.kind === "OPEN_CALL" && (await hasApplied(tx, challenge.id, input.backerId))) throw new ChallengeError("OWN_CHALLENGE");
    const before = challenge.pledgedCents;
    const held = await holdPledge(tx, challenge, input.backerId, input.amountCents, now);
    const goal = challenge.goalCents ?? 0;
    return {
      ...held,
      reachedGoal: goal > 0 && before < goal && held.challenge.pledgedCents >= goal,
    };
  });
}

// ── Answering, starting, applying, picking ────────────────────────────────────────────────────

export type DecisionOutcome = { kind: "ACCEPTED"; challenge: ChallengeRow } | { kind: "DECLINED"; challenge: ChallengeRow; releasedTo: string[] };

/** The dared creator accepts (they now have `delivery_days` to deliver) or declines (every pledge comes back). */
export async function answerRequest(input: { challengeId: string; creatorId: string; accept: boolean }, now = new Date()): Promise<DecisionOutcome> {
  return db.transaction(async (tx) => {
    const challenge = await lockChallenge(tx, input.challengeId);
    if (!challenge || challenge.kind !== "REQUEST" || challenge.creatorId !== input.creatorId) throw new ChallengeError("NOT_FOUND");
    if (challenge.status !== "OPEN" || now >= challenge.deadline) throw new ChallengeError("NOT_OPEN");
    if (input.accept)
      return {
        kind: "ACCEPTED",
        challenge: await commit(tx, challenge, now),
      } as const;
    const done = await finish(tx, challenge, "DECLINED", "Challenge declined", now);
    return { kind: "DECLINED", ...done } as const;
  });
}

/** A goal's creator starts as soon as the goal is reached, without waiting for the deadline (pledging stops). */
export async function startGoal(input: { challengeId: string; creatorId: string }, now = new Date()): Promise<ChallengeRow> {
  return db.transaction(async (tx) => {
    const challenge = await lockChallenge(tx, input.challengeId);
    if (!challenge || challenge.kind !== "GOAL" || challenge.creatorId !== input.creatorId) throw new ChallengeError("NOT_FOUND");
    if (challenge.status !== "OPEN") throw new ChallengeError("NOT_OPEN");
    if (challenge.pledgedCents < (challenge.goalCents ?? Number.MAX_SAFE_INTEGER)) throw new ChallengeError("GOAL_NOT_REACHED");
    return commit(tx, challenge, now);
  });
}

/** A creator offers to take an open call, with a short note for its author. */
export async function applyToChallenge(input: { challengeId: string; creatorId: string; note?: string | null }, now = new Date()) {
  return db.transaction(async (tx) => {
    const challenge = await lockChallenge(tx, input.challengeId);
    if (!challenge || challenge.kind !== "OPEN_CALL") throw new ChallengeError("NOT_FOUND");
    if (challenge.status !== "OPEN" || now >= challenge.deadline) throw new ChallengeError("NOT_OPEN");
    if (challenge.authorId === input.creatorId) throw new ChallengeError("OWN_CHALLENGE");
    // Nobody is paid with their own credits: a backer of an open call does not apply to it (nor an applicant pledge).
    const [backer] = await tx
      .select({ id: challengePledges.id })
      .from(challengePledges)
      .where(and(eq(challengePledges.challengeId, challenge.id), eq(challengePledges.backerId, input.creatorId), ne(challengePledges.status, "RELEASED")))
      .limit(1);
    if (backer) throw new ChallengeError("OWN_CHALLENGE");
    if (!(await activeCreator(tx, input.creatorId))) throw new ChallengeError("NOT_A_CREATOR");
    const [application] = await tx
      .insert(challengeApplications)
      .values({
        challengeId: challenge.id,
        creatorId: input.creatorId,
        note: input.note?.trim().slice(0, 280) || null,
      })
      .onConflictDoNothing()
      .returning();
    if (!application) throw new ChallengeError("ALREADY_APPLIED");
    return { challenge, application };
  });
}

/** The author of an open call picks one applicant, who now has `delivery_days` to deliver; the others are told. */
export async function assignChallenge(input: { challengeId: string; authorId: string; applicationId: string }, now = new Date()) {
  return db.transaction(async (tx) => {
    const challenge = await lockChallenge(tx, input.challengeId);
    if (!challenge || challenge.kind !== "OPEN_CALL" || challenge.authorId !== input.authorId) throw new ChallengeError("NOT_FOUND");
    if (challenge.status !== "OPEN" || now >= challenge.deadline) throw new ChallengeError("NOT_OPEN");
    const [chosen] = await tx
      .select()
      .from(challengeApplications)
      .where(
        and(
          eq(challengeApplications.id, input.applicationId),
          eq(challengeApplications.challengeId, challenge.id),
          eq(challengeApplications.status, "PENDING"),
        ),
      )
      .limit(1);
    if (!chosen || !(await activeCreator(tx, chosen.creatorId))) throw new ChallengeError("NOT_FOUND");
    await tx.update(challengeApplications).set({ status: "CHOSEN" }).where(eq(challengeApplications.id, chosen.id));
    const others = await tx
      .update(challengeApplications)
      .set({ status: "NOT_CHOSEN" })
      .where(and(eq(challengeApplications.challengeId, challenge.id), eq(challengeApplications.status, "PENDING")))
      .returning({ creatorId: challengeApplications.creatorId });
    const accepted = await commit(tx, challenge, now, chosen.creatorId);
    return { challenge: accepted, notChosen: others.map((o) => o.creatorId) };
  });
}

// ── Delivering ────────────────────────────────────────────────────────────────────────────────

/**
 * The creator delivers: a ready video of theirs (not in an auction, not used by another challenge) or a story they
 * posted after committing. The backers' pledges are paid to the creator in the same transaction; with a BACKERS reward
 * the delivery is played only by them (visibility CHALLENGE, a grant per backer), with EVERYONE it becomes public.
 */
export async function deliverChallenge(
  input: {
    challengeId: string;
    creatorId: string;
    videoId?: string | null;
    storyId?: string | null;
  },
  now = new Date(),
): Promise<{ challenge: ChallengeRow; paidBackers: string[] }> {
  return db.transaction(async (tx) => {
    const challenge = await lockChallenge(tx, input.challengeId);
    if (!challenge || challenge.creatorId !== input.creatorId) throw new ChallengeError("NOT_FOUND");
    if (challenge.status !== "ACCEPTED" || !challenge.deliveryDeadline || now > challenge.deliveryDeadline) throw new ChallengeError("NOT_IN_PROGRESS");
    const backersOnly = challenge.reward === "BACKERS";
    const delivery: Partial<ChallengeRow> = {};

    if (challenge.deliverable === "VIDEO") {
      if (!input.videoId) throw new ChallengeError("BAD_DELIVERY");
      const [video] = await tx
        .select()
        .from(videos)
        .where(and(eq(videos.id, input.videoId), eq(videos.creatorId, input.creatorId)))
        .for("update")
        .limit(1);
      if (!video || video.removedAt || video.status !== "READY" || video.visibility === "AUCTION" || video.visibility === "CHALLENGE")
        throw new ChallengeError("BAD_DELIVERY");
      const [used] = await tx.select({ id: challenges.id }).from(challenges).where(eq(challenges.deliveredVideoId, video.id)).limit(1);
      if (used) throw new ChallengeError("BAD_DELIVERY");
      await tx
        .update(videos)
        .set({
          visibility: backersOnly ? "CHALLENGE" : "PUBLIC",
          updatedAt: now,
        })
        .where(eq(videos.id, video.id));
      Object.assign(delivery, {
        deliveredVideoId: video.id,
        previousVisibility: video.visibility,
      });
    } else {
      if (!input.storyId) throw new ChallengeError("BAD_DELIVERY");
      const [story] = await tx
        .select()
        .from(stories)
        .where(and(eq(stories.id, input.storyId), eq(stories.creatorId, input.creatorId)))
        .for("update")
        .limit(1);
      const fresh = story && challenge.acceptedAt && story.createdAt >= challenge.acceptedAt;
      if (!story || !fresh || story.removedAt || story.status !== "READY" || story.expiresAt <= now) throw new ChallengeError("BAD_DELIVERY");
      await tx
        .update(stories)
        .set({
          visibility: backersOnly ? "CHALLENGE" : "PUBLIC",
          audienceListId: null,
          updatedAt: now,
        })
        .where(eq(stories.id, story.id));
      Object.assign(delivery, { deliveredStoryId: story.id });
    }

    const held = await tx
      .select()
      .from(challengePledges)
      .where(and(eq(challengePledges.challengeId, challenge.id), eq(challengePledges.status, "HELD")));
    for (const pledge of held) {
      // The hold becomes the payment: released and spent in the same transaction, so the balance never moves.
      await tx
        .insert(walletLedger)
        .values([
          {
            userId: pledge.backerId,
            entryType: "RELEASE",
            amountCents: pledge.amountCents,
            reference: `release_cpl_${pledge.id}`,
            note: "Challenge delivered",
          },
          {
            userId: pledge.backerId,
            entryType: "SPEND",
            amountCents: -pledge.amountCents,
            reference: `spend_cpl_${pledge.id}`,
            note: "Challenge delivered",
          },
        ])
        .onConflictDoNothing();
      await creditTip(tx as LedgerExecutor, {
        senderId: pledge.backerId,
        creatorId: input.creatorId,
        videoId: delivery.deliveredVideoId ?? null,
        grossAmountCents: pledge.amountCents,
        gateway: "CREDITS",
        gatewayTransactionRef: `challenge_${pledge.id}`,
        note: "Challenge delivered",
        grant: { via: "CHALLENGE" },
      });
    }
    if (held.length > 0)
      await tx
        .update(challengePledges)
        .set({ status: "PAID" })
        .where(
          inArray(
            challengePledges.id,
            held.map((p) => p.id),
          ),
        );

    const [delivered] = await tx
      .update(challenges)
      .set({
        ...delivery,
        status: "DELIVERED",
        deliveredAt: now,
        closedAt: now,
        updatedAt: now,
      })
      .where(eq(challenges.id, challenge.id))
      .returning();
    return {
      challenge: delivered,
      paidBackers: [...new Set(held.map((p) => p.backerId))],
    };
  });
}

// ── Closing and cancelling ────────────────────────────────────────────────────────────────────

export type ChallengeCloseOutcome =
  | { kind: "FUNDED"; challenge: ChallengeRow }
  | {
      kind: "EXPIRED" | "FAILED";
      challenge: ChallengeRow;
      releasedTo: string[];
    }
  | { kind: "NOOP" };

/**
 * Moves a challenge past its deadline: a goal reached is funded (the creator must deliver), anything else open expires;
 * an accepted challenge not delivered in time fails. Every pledge of a challenge that does not happen comes back.
 * Idempotent; `skipLocked` lets several closers share the queue.
 */
export async function closeChallenge(challengeId: string, now = new Date(), { skipLocked = false } = {}): Promise<ChallengeCloseOutcome> {
  return db.transaction(async (tx) => {
    const challenge = await lockChallenge(tx, challengeId, skipLocked);
    if (!challenge) return { kind: "NOOP" } as const;
    if (challenge.status === "ACCEPTED" && challenge.deliveryDeadline && challenge.deliveryDeadline < now) {
      return {
        kind: "FAILED",
        ...(await finish(tx, challenge, "FAILED", "Challenge not delivered", now)),
      } as const;
    }
    if (challenge.status !== "OPEN" || challenge.deadline > now) return { kind: "NOOP" } as const;
    if (challenge.kind === "GOAL" && challenge.goalCents && challenge.pledgedCents >= challenge.goalCents) {
      return {
        kind: "FUNDED",
        challenge: await commit(tx, challenge, now),
      } as const;
    }
    return {
      kind: "EXPIRED",
      ...(await finish(tx, challenge, "EXPIRED", "Challenge expired", now)),
    } as const;
  });
}

/**
 * Cancels a challenge. Its author may while it is open (a goal's creator, a request's sender, an open call's author);
 * an operator (`byOperator`) at any point before delivery — a takedown, a suspension. Every pledge comes back.
 */
export async function cancelChallenge(
  input: {
    challengeId: string;
    authorId?: string;
    byOperator?: boolean;
    reason: string;
  },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const challenge = await lockChallenge(tx, input.challengeId);
    if (!challenge || (!input.byOperator && challenge.authorId !== input.authorId)) throw new ChallengeError("NOT_FOUND");
    if (challenge.status !== "OPEN" && !(input.byOperator && challenge.status === "ACCEPTED")) throw new ChallengeError("NOT_OPEN");
    return finish(tx, challenge, "CANCELLED", "Challenge cancelled", now, input.reason);
  });
}

/** Challenges with work to do: open ones past their deadline and accepted ones past their delivery deadline. */
export async function dueChallengeIds(now = new Date(), limit = 25): Promise<string[]> {
  const rows = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(or(and(eq(challenges.status, "OPEN"), lte(challenges.deadline, now)), and(eq(challenges.status, "ACCEPTED"), lte(challenges.deliveryDeadline, now))))
    .orderBy(asc(challenges.deadline))
    .limit(limit);
  return rows.map((r) => r.id);
}

/** The challenges an operator action must stop: everything not final that an account wrote or must make. */
export async function activeChallengeIdsFor(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: challenges.id })
    .from(challenges)
    .where(and(inArray(challenges.status, ["OPEN", "ACCEPTED"]), or(eq(challenges.authorId, userId), eq(challenges.creatorId, userId))));
  return rows.map((r) => r.id);
}

/** Credits an account has held behind challenge pledges (already out of its balance, given back if it does not happen). */
export async function heldInChallengesCents(userId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${challengePledges.amountCents}), 0)`,
    })
    .from(challengePledges)
    .where(and(eq(challengePledges.backerId, userId), eq(challengePledges.status, "HELD")));
  return Number(row?.total ?? 0);
}
