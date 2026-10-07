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
  payoutRequests,
  contacts,
  follows,
  complianceReports,
} from "./schema";
import { loadRootEnv } from "./load-env";

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
  visibility: "PUBLIC" | "CONTACTS_ONLY" | "APPROVED_FOLLOWERS_ONLY" | "TIPPED_UNLOCKED";
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
    thumb: "photo-1571266028243-d220c6a8b0e8", views: 5210, tags: ["acoustic", "live", "lounge"],
  },
  {
    bunnyVideoId: "8a3c2d99-5e4f-4b7a-9c0d-1e2f3a4b5c6d", creator: "miasterling", title: "Rehearsal Tapes — Contacts Only",
    description: "Unpolished rehearsals, shared with the people I know.", visibility: "CONTACTS_ONLY", duration: 1210,
    thumb: "photo-1511379938547-c1f69419868d", views: 380, tags: ["acoustic", "rehearsal"],
  },
  {
    bunnyVideoId: "9b4d3eaa-6f5a-4c8b-0d1e-2f3a4b5c6d7e", creator: "miasterling", title: "Afterhours (encoding)",
    description: "Uploaded, still encoding on Bunny Stream.", visibility: "PUBLIC", status: "PROCESSING", duration: 0,
    thumb: "photo-1470225620780-dba8ba36b745", views: 0, tags: ["live"],
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
  const id: Record<string, string> = {};

  for (const p of PEOPLE) {
    await db
      .insert(users)
      .values({ email: p.email, username: p.username, passwordHash: hashPassword(p.password), role: p.role, isVerified: p.isVerified, isAgeVerified: true })
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

  // Playlists: a public collection on Elena's page, Alex's favourites.
  const playlist = async (owner: string, title: string, description: string, isPrivate: boolean, items: string[]) => {
    let [row] = await db.select({ id: playlists.id }).from(playlists).where(and(eq(playlists.creatorId, id[owner]), eq(playlists.title, title))).limit(1);
    if (!row) [row] = await db.insert(playlists).values({ creatorId: id[owner], title, description, isPrivate }).returning({ id: playlists.id });
    for (const [position, bunnyId] of items.entries()) {
      await db.insert(playlistItems).values({ playlistId: row.id, videoId: video[bunnyId], position }).onConflictDoNothing();
    }
  };
  await playlist("elenavox", "Tokyo Neon Nights", "The episodic 4K series, in order.", false, [
    "9b3c4a12-8819-4820-a6fe-b715a3e144bb",
    "2d7f8c91-9921-4d30-b2aa-c819a5f255cc",
  ]);
  await playlist("alex_vance", "Late-night favourites", "What I come back to after midnight.", false, [
    "7f2b1c88-4d3e-4a6f-8b9c-0d1e2f3a4b5c",
    "9b3c4a12-8819-4820-a6fe-b715a3e144bb",
  ]);

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
