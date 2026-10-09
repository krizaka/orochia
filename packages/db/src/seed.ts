import { and, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { hashPassword } from "./crypto";
import {
  users,
  profiles,
  videos,
  videoAccessGrants,
  tipsLedger,
  playlists,
  playlistItems,
  playlistMembers,
  audienceLists,
  audienceListMembers,
  videoAudienceLists,
  videoComments,
  videoLikes,
  payoutRequests,
  contacts,
  follows,
  complianceReports,
  stories,
  contentRatings,
} from "./schema";
import { loadRootEnv } from "./load-env";
import { ensureOwner, ownerFromEnv } from "./owner";

// The client connects lazily, so loading .env here still precedes the first query.
loadRootEnv(__dirname);

/**
 * Development seed — a small, coherent platform that exercises every feature: verified and
 * pending creators, every visibility, follows (approved and pending), contacts, playlists, paid
 * unlocks written to the ledger the way settlement writes them (10 % platform fee), a payout
 * within the available balance and an open report.
 *
 * Idempotent: every row has a natural key (e-mail, Bunny video id, gateway reference…), so running
 * it twice changes nothing. Never run against production — `npm run db:seed` refuses to.
 */

const FEE_PERCENT = 10;
const img = (id: string, w = 800) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

interface SeedUser {
  email: string;
  username: string;
  password: string;
  role: "ADMIN" | "CREATOR" | "MEMBER";
  isVerified: boolean;
  profile: { displayName: string; bio: string; avatar?: string; banner?: string; minTip?: number; payoutCrypto?: string };
}

const PEOPLE: SeedUser[] = [
  {
    email: "admin@orochia.org", username: "orochia_admin", password: "admin1234", role: "ADMIN", isVerified: true,
    profile: { displayName: "Orochia Operator", bio: "Platform operator: 2257 records, moderation and treasury.", avatar: img("photo-1535713875002-d1d0cf377fde", 400) },
  },
  {
    email: "elena@orochia.org", username: "elenavox", password: "elena1234", role: "CREATOR", isVerified: true,
    profile: {
      displayName: "Elena Vox", bio: "Visual artist, nocturnal producer & independent 4K cinema director.",
      avatar: img("photo-1534528741775-53994a69daeb", 400), banner: img("photo-1503899036084-c55cdd92da26", 1600), minTip: 1000,
      payoutCrypto: "TLvQZ9oP3x84Ujk7Yv9LKm82qNx (USDT-TRC20)",
    },
  },
  {
    email: "mia@orochia.org", username: "miasterling", password: "mia1234", role: "CREATOR", isVerified: true,
    profile: {
      displayName: "Mia Sterling", bio: "Acoustic lounge vocalist and late-night composer.",
      avatar: img("photo-1517841905240-472988babdf9", 400), banner: img("photo-1470225620780-dba8ba36b745", 1600), minTip: 500,
    },
  },
  {
    email: "nova@orochia.org", username: "novaray", password: "nova1234", role: "CREATOR", isVerified: false,
    profile: { displayName: "Nova Ray", bio: "New creator — 2257 records awaiting review." },
  },
  {
    email: "alex@sanctuary.io", username: "alex_vance", password: "alex1234", role: "MEMBER", isVerified: true,
    profile: { displayName: "Alex Vance", bio: "Patron of independent cinema and underground sound.", avatar: img("photo-1507003211169-0a1dd7228f2d", 400) },
  },
  {
    email: "sam@sanctuary.io", username: "sam_rivers", password: "sam1234", role: "MEMBER", isVerified: true,
    profile: { displayName: "Sam Rivers", bio: "Late-night listener." },
  },
];

interface SeedVideo {
  bunnyVideoId: string;
  creator: string;
  title: string;
  description: string;
  visibility: "PUBLIC" | "CONTACTS_ONLY" | "APPROVED_FOLLOWERS_ONLY" | "TIPPED_UNLOCKED" | "INVITED_ONLY";
  status?: "READY" | "PROCESSING";
  minTip?: number;
  duration: number;
  thumb: string;
  views: number;
  tags: string[];
}

const VIDEOS: SeedVideo[] = [
  {
    bunnyVideoId: "9b3c4a12-8819-4820-a6fe-b715a3e144bb", creator: "elenavox", title: "Tokyo Neon Horizons — Episode 01: The Velvet Alley",
    description: "A late-night cinematic walk through Shinjuku's hidden art lounges.", visibility: "PUBLIC", duration: 1420,
    thumb: "photo-1503899036084-c55cdd92da26", views: 8940, tags: ["cinematic", "tokyo", "4k", "neon"],
  },
  {
    bunnyVideoId: "2d7f8c91-9921-4d30-b2aa-c819a5f255cc", creator: "elenavox", title: "Velvet Lounge Private Session — 4K Director's Cut",
    description: "The full private performance with the director's commentary.", visibility: "TIPPED_UNLOCKED", minTip: 1000, duration: 2850,
    thumb: "photo-1514525253161-7a46d19cd819", views: 3100, tags: ["exclusive", "directors-cut", "4k"],
  },
  {
    bunnyVideoId: "5e1a0b77-3c2d-4f5e-9a8b-7c6d5e4f3a2b", creator: "elenavox", title: "Studio Diaries — Approved Followers Edition",
    description: "Behind the scenes of the next episode, for the followers I approved.", visibility: "APPROVED_FOLLOWERS_ONLY", duration: 960,
    thumb: "photo-1492691527719-9d1e07e534b4", views: 640, tags: ["behind-the-scenes", "studio"],
  },
  {
    bunnyVideoId: "7f2b1c88-4d3e-4a6f-8b9c-0d1e2f3a4b5c", creator: "miasterling", title: "Midnight Noir — Acoustic Lounge Session",
    description: "Three songs, one microphone, no second take.", visibility: "PUBLIC", duration: 1980,
    thumb: "photo-1511671782779-c97d3d27a1d4", views: 5210, tags: ["acoustic", "concert", "lounge"],
  },
  {
    bunnyVideoId: "8a3c2d99-5e4f-4b7a-9c0d-1e2f3a4b5c6d", creator: "miasterling", title: "Rehearsal Tapes — Contacts Only",
    description: "Unpolished rehearsals, shared with the people I know.", visibility: "CONTACTS_ONLY", duration: 1210,
    thumb: "photo-1511379938547-c1f69419868d", views: 380, tags: ["acoustic", "rehearsal"],
  },
  {
    bunnyVideoId: "9b4d3eaa-6f5a-4c8b-0d1e-2f3a4b5c6d7e", creator: "miasterling", title: "Afterhours (encoding)",
    description: "Uploaded, still encoding on Bunny Stream.", visibility: "PUBLIC", status: "PROCESSING", duration: 0,
    thumb: "photo-1470225620780-dba8ba36b745", views: 0, tags: ["concert"],
  },
  {
    bunnyVideoId: "c4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f70", creator: "elenavox", title: "Inner Circle — Rough Cut",
    description: "The first assembly, for the people on my Inner circle list only.", visibility: "INVITED_ONLY", duration: 640,
    thumb: "photo-1492684223066-81342ee5ff30", views: 0, tags: ["behind-the-scenes"],
  },
];

/** Paid unlocks / tips, written exactly as settlement writes them (CREATOR_CREDIT + access grant). */
const CREDITS = [
  { ref: "seed-ccbill-0001", sender: "alex_vance", video: "2d7f8c91-9921-4d30-b2aa-c819a5f255cc", gross: 1000, gateway: "CCBILL" as const, note: "Director's cut unlock" },
  { ref: "seed-crypto-0002", sender: "sam_rivers", video: "2d7f8c91-9921-4d30-b2aa-c819a5f255cc", gross: 2500, gateway: "CRYPTO" as const, note: "Director's cut unlock" },
  { ref: "seed-segpay-0003", sender: "alex_vance", video: "7f2b1c88-4d3e-4a6f-8b9c-0d1e2f3a4b5c", gross: 1500, gateway: "SEGPAY" as const, note: "Tip" },
];

export async function runSeed(): Promise<void> {
  console.log("🌱 Seeding Orochia (idempotent)…");

  // Content ratings are reference data installed by migration 0013 in every environment (seed and migration agree).
  const RATINGS = [
    { id: "FOR_KIDS", label: "Kids safe", description: "Suitable for children and families: no strong language, no violence.", isAdult: false, requiresBlur: false, defaultTags: ["family", "kids"], minAge: 0, displayOrder: 1, iconName: "baby" },
    { id: "GENERAL", label: "General audience", description: "Suitable for most viewers.", isAdult: false, requiresBlur: false, defaultTags: ["general"], minAge: 0, displayOrder: 2, iconName: "users" },
    { id: "TEEN", label: "Teens (13+)", description: "Suitable from 13. May touch on more mature themes.", isAdult: false, requiresBlur: false, defaultTags: ["teen"], minAge: 13, displayOrder: 3, iconName: "user-check" },
    { id: "MATURE", label: "Mature (18+)", description: "Adults only. Sensitive or intense themes.", isAdult: true, requiresBlur: false, defaultTags: ["mature", "18+"], minAge: 18, displayOrder: 4, iconName: "shield-alert" },
    { id: "ADULT", label: "Adult explicit (18+)", description: "Explicit content for verified adults. The preview is blurred by default.", isAdult: true, requiresBlur: true, defaultTags: ["adult", "18+"], minAge: 18, displayOrder: 5, iconName: "alert-triangle" },
  ];
  for (const r of RATINGS) {
    await db.insert(contentRatings).values(r).onConflictDoNothing();
  }

  const id: Record<string, string> = {};

  for (const p of PEOPLE) {
    await db
      .insert(users)
      .values({ email: p.email, username: p.username, passwordHash: hashPassword(p.password), role: p.role, isVerified: p.isVerified, isAgeVerified: true, dateOfBirth: "1995-06-15", emailVerifiedAt: new Date() })
      .onConflictDoNothing();
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, p.email)).limit(1);
    id[p.username] = row.id;
    await db
      .insert(profiles)
      .values({
        userId: row.id,
        displayName: p.profile.displayName,
        bio: p.profile.bio,
        avatarUrl: p.profile.avatar ?? null,
        bannerUrl: p.profile.banner ?? null,
        minTipAmountCents: p.profile.minTip ?? 500,
        payoutAddressCrypto: p.profile.payoutCrypto ?? null,
      })
      .onConflictDoNothing();
  }

  const video: Record<string, string> = {};
  for (const v of VIDEOS) {
    await db
      .insert(videos)
      .values({
        creatorId: id[v.creator],
        bunnyVideoId: v.bunnyVideoId,
        title: v.title,
        description: v.description,
        visibility: v.visibility,
        status: v.status ?? "READY",
        minTipAmountCents: v.minTip ?? 0,
        durationSeconds: v.duration,
        thumbnailUrl: img(v.thumb),
        previewAnimationUrl: img(v.thumb, 400),
        viewsCount: v.views,
        tags: v.tags,
        resolutions: v.status === "PROCESSING" ? [] : ["2160p", "1080p", "720p"],
      })
      .onConflictDoNothing();
    const [row] = await db.select({ id: videos.id }).from(videos).where(eq(videos.bunnyVideoId, v.bunnyVideoId)).limit(1);
    video[v.bunnyVideoId] = row.id;
  }

  // Ledger: a gateway reference credits once (unique index), so re-running inserts nothing.
  for (const c of CREDITS) {
    const fee = Math.round((c.gross * FEE_PERCENT) / 100);
    const videoId = video[c.video];
    const [creator] = await db.select({ id: videos.creatorId }).from(videos).where(eq(videos.id, videoId)).limit(1);
    const inserted = await db
      .insert(tipsLedger)
      .values({
        entryType: "CREATOR_CREDIT",
        senderId: id[c.sender],
        creatorId: creator.id,
        videoId,
        grossAmountCents: c.gross,
        platformFeeCents: fee,
        netAmountCents: c.gross - fee,
        gateway: c.gateway,
        gatewayTransactionRef: c.ref,
        note: c.note,
      })
      .onConflictDoNothing()
      .returning({ id: tipsLedger.id });
    if (inserted.length === 0) continue;
    await db.update(videos).set({ tipsCount: sql`${videos.tipsCount} + 1` }).where(eq(videos.id, videoId));
    await db
      .update(profiles)
      .set({ totalTipsEarnedCents: sql`${profiles.totalTipsEarnedCents} + ${c.gross - fee}` })
      .where(eq(profiles.userId, creator.id));
    await db
      .insert(videoAccessGrants)
      .values({ videoId, userId: id[c.sender], grantedVia: "TIP_PAYMENT", amountPaidCents: c.gross, transactionRef: c.ref })
      .onConflictDoNothing();
  }

  // A payout request within Elena's balance (net credits: 900 + 2250 = 3150 cents).
  const [payout] = await db
    .select({ id: payoutRequests.id })
    .from(payoutRequests)
    .where(and(eq(payoutRequests.creatorId, id.elenavox), eq(payoutRequests.payoutDestination, "TLvQZ9oP3x84Ujk7Yv9LKm82qNx (USDT-TRC20)")))
    .limit(1);
  if (!payout) {
    await db.insert(payoutRequests).values({
      creatorId: id.elenavox,
      amountCents: 2000,
      status: "REQUESTED",
      payoutMethod: "CRYPTO_USDT",
      payoutDestination: "TLvQZ9oP3x84Ujk7Yv9LKm82qNx (USDT-TRC20)",
    });
    await db.insert(tipsLedger).values({
      entryType: "PAYOUT_REQUESTED",
      creatorId: id.elenavox,
      grossAmountCents: 2000,
      platformFeeCents: 0,
      netAmountCents: -2000,
      gateway: "CRYPTO",
      gatewayTransactionRef: "seed-payout-0001",
      note: "Payout request",
    });
  }

  // Social graph: Alex is an approved follower of Elena, Sam is waiting; Alex and Mia are contacts.
  await db.insert(follows).values({ followerId: id.alex_vance, creatorId: id.elenavox, status: "APPROVED", decidedAt: new Date() }).onConflictDoNothing();
  await db.insert(follows).values({ followerId: id.sam_rivers, creatorId: id.elenavox, status: "PENDING" }).onConflictDoNothing();
  await db.insert(follows).values({ followerId: id.alex_vance, creatorId: id.miasterling, status: "PENDING" }).onConflictDoNothing();
  await db.insert(contacts).values({ requesterId: id.alex_vance, addresseeId: id.miasterling, status: "ACCEPTED" }).onConflictDoNothing();
  await db.insert(contacts).values({ requesterId: id.sam_rivers, addresseeId: id.miasterling, status: "PENDING" }).onConflictDoNothing();

  // Collections: a public one on Elena's page, Alex's favourites, one Alex shares with Sam only.
  type Audience = "PUBLIC" | "APPROVED_FOLLOWERS_ONLY" | "CONTACTS_ONLY" | "INVITED_ONLY" | "PRIVATE";
  const playlist = async (owner: string, title: string, description: string, visibility: Audience, items: string[], invited: string[] = []) => {
    let [row] = await db.select({ id: playlists.id }).from(playlists).where(and(eq(playlists.creatorId, id[owner]), eq(playlists.title, title))).limit(1);
    if (!row) [row] = await db.insert(playlists).values({ creatorId: id[owner], title, description, visibility }).returning({ id: playlists.id });
    for (const [position, bunnyId] of items.entries()) {
      await db.insert(playlistItems).values({ playlistId: row.id, videoId: video[bunnyId], position }).onConflictDoNothing();
    }
    for (const username of invited) {
      await db.insert(playlistMembers).values({ playlistId: row.id, userId: id[username] }).onConflictDoNothing();
    }
  };
  await playlist("elenavox", "Tokyo Neon Nights", "The episodic 4K series, in order.", "PUBLIC", [
    "9b3c4a12-8819-4820-a6fe-b715a3e144bb",
    "2d7f8c91-9921-4d30-b2aa-c819a5f255cc",
  ]);
  await playlist("alex_vance", "Late-night favourites", "What I come back to after midnight.", "PUBLIC", [
    "7f2b1c88-4d3e-4a6f-8b9c-0d1e2f3a4b5c",
    "9b3c4a12-8819-4820-a6fe-b715a3e144bb",
  ]);
  await playlist("alex_vance", "For Sam", "The sessions I told you about.", "INVITED_ONLY", ["7f2b1c88-4d3e-4a6f-8b9c-0d1e2f3a4b5c"], ["sam_rivers"]);

  // Elena's "Inner circle" list (Alex) opens her invited-only rough cut.
  let [inner] = await db.select({ id: audienceLists.id }).from(audienceLists).where(and(eq(audienceLists.ownerId, id.elenavox), eq(audienceLists.name, "Inner circle"))).limit(1);
  if (!inner) [inner] = await db.insert(audienceLists).values({ ownerId: id.elenavox, name: "Inner circle" }).returning({ id: audienceLists.id });
  await db.insert(audienceListMembers).values({ listId: inner.id, userId: id.alex_vance }).onConflictDoNothing();
  await db.insert(videoAudienceLists).values({ videoId: video["c4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f70"], listId: inner.id }).onConflictDoNothing();

  // A short discussion and a few likes on the public videos.
  const noir = video["7f2b1c88-4d3e-4a6f-8b9c-0d1e2f3a4b5c"];
  const [discussion] = await db.select({ id: videoComments.id }).from(videoComments).where(eq(videoComments.videoId, noir)).limit(1);
  if (!discussion) {
    const [first] = await db
      .insert(videoComments)
      .values({ videoId: noir, authorId: id.alex_vance, body: "The second song gets me every time." })
      .returning({ id: videoComments.id });
    await db.insert(videoComments).values({ videoId: noir, authorId: id.miasterling, parentId: first.id, body: "Recorded at 3 a.m., one take. Thank you!" });
  }
  for (const [username, bunnyId] of [
    ["alex_vance", "7f2b1c88-4d3e-4a6f-8b9c-0d1e2f3a4b5c"],
    ["sam_rivers", "7f2b1c88-4d3e-4a6f-8b9c-0d1e2f3a4b5c"],
    ["alex_vance", "9b3c4a12-8819-4820-a6fe-b715a3e144bb"],
  ]) {
    await db.insert(videoLikes).values({ videoId: video[bunnyId], userId: id[username] }).onConflictDoNothing();
  }
  // Counters follow the rows, as the app keeps them.
  await db.execute(sql`
    update videos set
      likes_count = (select count(*) from video_likes l where l.video_id = videos.id),
      comments_count = (select count(*) from video_comments c where c.video_id = videos.id and c.removed_at is null),
      shares_count = (select count(*) from video_shares s where s.video_id = videos.id)`);

  // One open report for the moderation queue.
  const [report] = await db.select({ id: complianceReports.id }).from(complianceReports).where(eq(complianceReports.reporterEmail, "rights@example.com")).limit(1);
  if (!report) {
    await db.insert(complianceReports).values({
      videoId: video["7f2b1c88-4d3e-4a6f-8b9c-0d1e2f3a4b5c"],
      videoTitle: "Midnight Noir — Acoustic Lounge Session",
      reason: "DMCA_COPYRIGHT",
      details: "The second song is a cover performed without a licence (example report from the development seed).",
      reporterEmail: "rights@example.com",
    });
  }

  // Current stories (24 h): image stories, so they render locally without Bunny. Counters start at zero, as the rows say.
  const [liveStories] = await db.select({ count: sql<string>`count(*)` }).from(stories).where(sql`expires_at > now()`);
  if (Number(liveStories?.count ?? 0) === 0) {
    const inHours = (h: number) => new Date(Date.now() + h * 3600 * 1000);
    await db.insert(stories).values([
      { creatorId: id.elenavox, mediaType: "IMAGE", mediaUrl: img("photo-1542051841857-5f90071e7989", 1080), thumbnailUrl: img("photo-1542051841857-5f90071e7989", 400), caption: "Shinjuku tonight — episode 02 drops this weekend.", visibility: "PUBLIC", expiresAt: inHours(20) },
      { creatorId: id.elenavox, mediaType: "IMAGE", mediaUrl: img("photo-1492684223066-81342ee5ff30", 1080), thumbnailUrl: img("photo-1492684223066-81342ee5ff30", 400), caption: "Rough cut, for the followers I approved.", visibility: "APPROVED_FOLLOWERS_ONLY", expiresAt: inHours(22) },
      { creatorId: id.miasterling, mediaType: "IMAGE", mediaUrl: img("photo-1511379938547-c1f69419868d", 1080), thumbnailUrl: img("photo-1511379938547-c1f69419868d", 400), caption: "New strings, same old guitar.", visibility: "PUBLIC", expiresAt: inHours(12) },
    ]);
  }

  // The owner account from OROCHIA_OWNER_* (as in production, where the release job applies it).
  const owner = ownerFromEnv();
  if (owner) {
    const outcome = await ensureOwner(db, owner);
    console.log(`✅ Owner account ${outcome.created ? "created" : "up to date"}: ${owner.email}`);
  }

  console.log("✅ Seed complete. Accounts (development only):");
  for (const p of PEOPLE) console.log(`   ${p.role.padEnd(7)} ${p.email.padEnd(20)} ${p.password}${p.role === "CREATOR" && !p.isVerified ? "   (2257 pending)" : ""}`);
}

if (require.main === module) {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV=production.");
    process.exit(1);
  }
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
