/**
 * The official demo of Orochia — `npm run demo:seed` (scripts/demo.mjs prepares an empty, dedicated database and runs
 * this file against it). Never run it by hand on another database: it expects an empty schema.
 *
 * The cast (scripts/demo/cast.json) is invented: Elena Marlow, a singer-songwriter who films her own music videos,
 * and Alex Carter, a fan, plus a few creators and fans around them. Illustrated avatars (public/defaults), licensed
 * clips (public/showcase) — no real face, no real name, no explicit content, e-mails on example.com.
 *
 * Every figure goes through the code that keeps it in production: payments are credited by the ledger with the
 * platform fee (`recordTipAndUnlock`), credits are test top-ups (`grantTestTopup`), the auction and the goal are
 * opened and funded by `createAuction` / `placeBid` / `createChallenge` / `pledgeChallenge` (escrowed credits), the
 * payouts by `requestPayout` to a payout account saved like the app saves it. Only dates are moved back afterwards,
 * so the history spans a few months.
 */
import fs from "node:fs";
import path from "node:path";

const rootEnv = path.resolve(__dirname, "..", "..", "..", ".env");
if (fs.existsSync(rootEnv)) process.loadEnvFile(rootEnv);

import cast from "../../../scripts/demo/cast.json";

type Key = string;

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed the demo: NODE_ENV=production");
  const { APP_DEMO_SEED } = process.env;
  if (APP_DEMO_SEED !== "1") throw new Error("Run the demo seed through `npm run demo:seed` (it prepares a dedicated database).");
  // Only ever a dedicated demo database on this machine — never the shared development one.
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "::1"].includes(target.hostname) || !/demo/.test(target.pathname)) {
    throw new Error(`Refusing to seed the demo into ${target.hostname}${target.pathname}: a local database whose name contains "demo" only.`);
  }

  const { db, users, profiles, videos, follows, stories, storyViews, storyLikes, videoLikes, videoComments, notifications, tipsLedger, payoutRequests, challengePledges, auctionBids, walletLedger } =
    await import("@orochia/db");
  const { sql, eq, inArray } = await import("drizzle-orm");
  const payments = await import("@orochia/payments");
  const { hashPassword } = await import("../../../packages/db/src/crypto");
  const { DEFAULT_AVATARS, DEFAULT_BANNERS } = await import("../lib/presets");
  const { savePayoutAccount, payoutDestinationOf } = await import("../lib/payout-account");

  const now = Date.now();
  const ago = (days: number, hours = 0) => new Date(now - days * 86_400_000 - hours * 3_600_000);
  const presetUrl = (list: { id: string; url: string }[], id?: string) => (id ? (list.find((p) => p.id === id)?.url ?? null) : null);

  // ── People ────────────────────────────────────────────────────────────────────────────────────
  const id: Record<Key, string> = {};
  for (const p of cast.people) {
    const creator = p.role === "CREATOR";
    const [row] = await db
      .insert(users)
      .values({
        email: p.email,
        username: p.username,
        passwordHash: hashPassword(cast.password),
        role: p.role as "CREATOR" | "MEMBER",
        isVerified: creator,
        isAgeVerified: true,
        dateOfBirth: "1994-04-12",
        emailVerifiedAt: ago(200),
        createdAt: ago(creator ? 240 : 150),
      })
      .returning({ id: users.id });
    id[p.key] = row.id;
    await db.insert(profiles).values({
      userId: row.id,
      displayName: p.displayName,
      bio: p.bio || null,
      avatarUrl: presetUrl(DEFAULT_AVATARS, p.avatar),
      bannerUrl: presetUrl(DEFAULT_BANNERS, "banner" in p ? p.banner : undefined),
      websiteUrl: "website" in p ? p.website : null,
      minTipAmountCents: "minTipCents" in p ? p.minTipCents : 500,
    });
  }

  // ── Videos (ready; posters made from the licensed clips) ─────────────────────────────
  const video: Record<Key, string> = {};
  for (const v of cast.videos) {
    const [row] = await db
      .insert(videos)
      .values({
        creatorId: id[v.creator],
        bunnyVideoId: v.bunnyId,
        title: v.title,
        description: v.description,
        visibility: v.visibility as "PUBLIC",
        status: "READY",
        minTipAmountCents: "minTipCents" in v ? v.minTipCents : 0,
        durationSeconds: v.duration,
        thumbnailUrl: `/uploads/demo/${v.key}.jpg`, // written by scripts/demo.mjs from the clip
        viewsCount: v.views,
        tags: v.tags,
        contentRatingId: "GENERAL",
        resolutions: ["1080p", "720p"],
        createdAt: ago(v.daysAgo),
        updatedAt: ago(v.daysAgo),
      })
      .returning({ id: videos.id });
    video[v.key] = row.id;
  }

  // ── Followers (approved), a few likes and a short discussion ─────────────────────────────────
  for (const [fan, creator] of cast.follows) {
    await db.insert(follows).values({ followerId: id[fan], creatorId: id[creator], status: "APPROVED", createdAt: ago(90), decidedAt: ago(89) });
  }
  for (const fan of ["alex", "sam", "lina", "omar", "jules"]) {
    for (const v of ["neonRain", "glassHearts", "afterglow"]) await db.insert(videoLikes).values({ videoId: video[v], userId: id[fan] }).onConflictDoNothing();
  }
  const [first] = await db.insert(videoComments).values({ videoId: video.neonRain, authorId: id.sam, body: "The shot at 2:40, under the bridge — goosebumps.", createdAt: ago(40) }).returning({ id: videoComments.id });
  await db.insert(videoComments).values({ videoId: video.neonRain, authorId: id.elena, parentId: first.id, body: "Third take, the rain stopped right after. Thank you!", createdAt: ago(39) });
  await db.insert(videoComments).values({ videoId: video.glassHearts, authorId: id.lina, body: "I was there. That last chorus!", createdAt: ago(25) });
  await db.execute(sql`
    update videos set
      likes_count = (select count(*) from video_likes l where l.video_id = videos.id),
      comments_count = (select count(*) from video_comments c where c.video_id = videos.id and c.removed_at is null)`);

  // ── Stories: video stories, playable for 24 h from now minus their age ───────────────────────
  const story: Record<Key, string> = {};
  for (const s of cast.stories) {
    const created = ago(0, s.hoursAgo);
    const [row] = await db
      .insert(stories)
      .values({
        creatorId: id[s.creator],
        mediaType: "VIDEO",
        bunnyVideoId: s.bunnyId,
        thumbnailUrl: `/showcase/${s.clip}.jpg`,
        caption: s.caption,
        visibility: "PUBLIC",
        status: "READY",
        durationSeconds: 6,
        expiresAt: new Date(created.getTime() + 24 * 3_600_000),
        createdAt: created,
        updatedAt: created,
      })
      .returning({ id: stories.id });
    story[s.key] = row.id;
    for (const fan of s.views) await db.insert(storyViews).values({ storyId: row.id, viewerId: id[fan], viewerKey: `u:${id[fan]}` });
    for (const fan of s.likes) await db.insert(storyLikes).values({ storyId: row.id, userId: id[fan] });
    await db.update(stories).set({ viewsCount: s.views.length, likesCount: s.likes.length }).where(eq(stories.id, row.id));
  }

  // ── Payments received, credited by the ledger (10 % platform fee), then dated back ───────────
  let n = 0;
  const dated: { ref: string; at: Date }[] = [];
  for (const p of cast.payments) {
    const ref = `demo-${p.kind}-${++n}`;
    const v = cast.videos.find((x) => x.key === p.video)!;
    await payments.recordTipAndUnlock({
      senderId: id[p.from],
      creatorId: id[v.creator],
      videoId: video[p.video],
      grossAmountCents: p.cents,
      gateway: "CCBILL", // paid by card through the gateway, as most fans do
      gatewayTransactionRef: ref,
      note: p.kind === "unlock" ? "Unlock" : "Tip",
      ...(p.kind === "unlock" ? { grant: { via: "TIP_PAYMENT" as const } } : {}),
    });
    dated.push({ ref, at: ago(p.daysAgo, 3) });
  }
  for (const s of cast.stories) {
    for (const tip of s.tips) {
      const ref = `demo-story-tip-${++n}`;
      await payments.recordTipAndUnlock({ senderId: id[tip.from], creatorId: id[s.creator], storyId: story[s.key], grossAmountCents: tip.cents, gateway: "CCBILL", gatewayTransactionRef: ref, note: "Story tip" });
      dated.push({ ref, at: ago(0, s.hoursAgo - 1) });
    }
  }
  for (const { ref, at } of dated) await db.update(tipsLedger).set({ createdAt: at }).where(eq(tipsLedger.gatewayTransactionRef, ref));

  // ── Where Elena is paid (saved and sealed like the app does), her payouts ────────────────────
  await savePayoutAccount(id.elena, { method: "BANK_IBAN", holderName: "Elena Marlow", country: "FR", details: { iban: "FR7630006000011234567890189" } });
  const destination = await payoutDestinationOf(id.elena);
  for (const p of cast.payouts) {
    const request = await payments.requestPayout(id.elena, p.cents, destination.method, destination.sealed);
    const at = ago(p.daysAgo);
    const settled = p.status === "SETTLED";
    await db
      .update(payoutRequests)
      .set({ status: p.status as "SETTLED" | "REQUESTED", createdAt: at, updatedAt: at, ...(settled ? { reviewedAt: ago(p.daysAgo - 1), settledAt: ago(p.daysAgo - 2), txHashOrReference: "SEPA-DEMO-0001" } : {}) })
      .where(eq(payoutRequests.id, request.id));
    await db.update(tipsLedger).set({ createdAt: at }).where(eq(tipsLedger.gatewayTransactionRef, `payout_req_${request.id}`));
  }

  // ── Fans' credits (test top-ups), an auction in progress, a goal funded at 60 % ──────────────
  for (const [fan, pack] of Object.entries(cast.fanCredits)) await payments.grantTestTopup(id[fan], pack as "max", { ...process.env, PAYMENTS_CREDITS_MODE: "test" });

  const a = cast.auction;
  const auction = await payments.createAuction({
    creatorId: id.elena,
    videoId: video[a.video],
    startingPriceCents: a.startingPriceCents,
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + a.endsInHours * 3_600_000),
    rights: "WATCH",
    settlement: "CREATOR_DECIDES",
  });
  for (const [fan, cents] of a.bids) await payments.placeBid({ auctionId: auction.id, bidderId: id[fan as string], amountCents: cents as number });

  const g = cast.goal;
  const { challenge } = await payments.createChallenge({
    kind: "GOAL",
    authorId: id[g.creator],
    title: g.title,
    description: g.description,
    deliverable: g.deliverable as "VIDEO",
    deliveryDays: g.deliveryDays,
    reward: "BACKERS",
    goalCents: g.goalCents,
    deadline: new Date(now + g.deadlineDays * 86_400_000),
  });
  for (const [fan, cents] of g.pledges) await payments.pledgeChallenge({ challengeId: challenge.id, backerId: id[fan as string], amountCents: cents as number });

  // Activity of the last days, dated back (the auction opened yesterday, the goal three days ago).
  await db.execute(sql`update auctions set created_at = ${ago(1, 4)}, starts_at = ${ago(1, 4)} where id = ${auction.id}`);
  const bidRows = await db.select({ id: auctionBids.id }).from(auctionBids).where(eq(auctionBids.auctionId, auction.id)).orderBy(auctionBids.createdAt);
  for (const [i, b] of bidRows.entries()) await db.update(auctionBids).set({ createdAt: ago(0, 20 - i * 6) }).where(eq(auctionBids.id, b.id));
  await db.execute(sql`update challenges set created_at = ${ago(3)} where id = ${challenge.id}`);
  const pledgeRows = await db.select({ id: challengePledges.id }).from(challengePledges).where(eq(challengePledges.challengeId, challenge.id)).orderBy(challengePledges.createdAt);
  for (const [i, p] of pledgeRows.entries()) await db.update(challengePledges).set({ createdAt: ago(2 - i * 0.5) }).where(eq(challengePledges.id, p.id));
  await db.update(walletLedger).set({ createdAt: ago(5) }).where(inArray(walletLedger.entryType, ["TOPUP"]));

  // ── Elena's bell: what happened while she was away (read), the last few hours (unread) ───────
  const name = (k: Key) => cast.people.find((p) => p.key === k)!.displayName;
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const bell: { event: string; actor?: Key; vars: Record<string, string>; path: string; hours: number; read?: boolean }[] = [
    { event: "challengePledged", vars: { amount: money(2500), title: g.title, total: money(15000) }, path: `/challenges/${challenge.id}`, hours: 2 },
    { event: "tipReceived", actor: "lina", vars: { name: name("lina"), amount: money(500), title: "" }, path: "/dashboard?tab=ledger", hours: 2 },
    { event: "auctionNewBid", vars: { title: cast.videos.find((v) => v.key === a.video)!.title, amount: money(3000) }, path: `/watch/${video[a.video]}#auction`, hours: 8 },
    { event: "videoUnlocked", actor: "sam", vars: { name: name("sam"), amount: money(1500), title: cast.videos.find((v) => v.key === "acoustic")!.title }, path: "/dashboard?tab=ledger", hours: 72, read: true },
    { event: "newFollower", actor: "jules", vars: { name: name("jules"), action: "now follows you" }, path: "/@julesmartin", hours: 96, read: true },
  ];
  for (const b of bell) {
    const at = ago(0, b.hours);
    await db.insert(notifications).values({ userId: id.elena, event: b.event, actorId: b.actor ? id[b.actor] : null, vars: b.vars, path: b.path, createdAt: at, readAt: b.read ? at : null });
  }

  const balance = await payments.getCreatorAvailableBalanceCents(id.elena);
  console.log(`✓ Demo ready — Elena's available balance ${money(balance)}, goal at ${Math.round((15000 / g.goalCents) * 100)} %, auction led at ${money(3000)}.`);
  console.log(`  Sign in as ${cast.people.filter((p) => ["elena", "alex"].includes(p.key)).map((p) => p.email).join(" or ")} — password ${cast.password}`);
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error("✗", error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
