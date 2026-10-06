import { db } from "./client";
import { users, profiles, videos, videoAccessGrants, tipsLedger } from "./schema";

export async function runSeed() {
  console.log("🌱 Seeding Orochia database with initial creators, videos, and test data...");

  // 1. Seed Admin & Creators
  const [creator1] = await db
    .insert(users)
    .values({
      email: "elena@krizaka.com",
      username: "elenavox",
      passwordHash: "$2b$10$wT8K2hM9YdF81r5qZg.qGOGf3B/nK5r1iW7yH/K.hU9O4zP8m0jS.", // demo hash
      role: "CREATOR",
      isVerified: true,
      isAgeVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  if (creator1) {
    await db.insert(profiles).values({
      userId: creator1.id,
      displayName: "Elena Vox",
      bio: "High-production cinematic visual narratives and behind-the-scenes community.",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      bannerUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      twitterHandle: "elenavox_studio",
      minTipAmountCents: 1000, // $10.00
      payoutAddressCrypto: "0x71C...aB49",
      payoutAccountCcbill: "950000-0001",
      totalViews: 14200,
      totalTipsEarnedCents: 350000,
    });

    // 2. Seed Sample Public Video
    const [pubVideo] = await db
      .insert(videos)
      .values({
        creatorId: creator1.id,
        bunnyVideoId: "9b3c4a12-8819-4820-a6fe-b715a3e144bb",
        title: "Tokyo Neon Horizons — Episode 01: The Velvet Alley",
        description: "An exclusive late-night cinematic exploration of Shinjuku's hidden underground art lounges.",
        visibility: "PUBLIC",
        status: "READY",
        minTipAmountCents: 0,
        durationSeconds: 1420,
        thumbnailUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
        previewAnimationUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=400&q=80",
        viewsCount: 8940,
        tipsCount: 42,
        tags: ["cinematic", "tokyo", "4k", "art"],
        resolutions: ["2160p", "1080p", "720p"],
      })
      .returning();

    // 3. Seed Paywalled/Tipped Video
    const [vipVideo] = await db
      .insert(videos)
      .values({
        creatorId: creator1.id,
        bunnyVideoId: "2d7f8c91-9921-4d30-b2aa-c819a5f255cc",
        title: "Velvet Lounge Private Session — 4K Uncut Director's Cut",
        description: "Unfiltered private performance and creator commentary. Unlocked with $10 minimum tip.",
        visibility: "TIPPED_UNLOCKED",
        status: "READY",
        minTipAmountCents: 1000, // $10.00
        durationSeconds: 2850,
        thumbnailUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
        previewAnimationUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80",
        viewsCount: 3100,
        tipsCount: 185,
        tags: ["uncut", "exclusive", "directors-cut"],
        resolutions: ["2160p", "1080p", "720p"],
      })
      .returning();

    console.log("✅ Seed completed successfully. Sample videos ready.");
  } else {
    console.log("ℹ️ Elena Vox user already exists, seed skipped.");
  }
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
