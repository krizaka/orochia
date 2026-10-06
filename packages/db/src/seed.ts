import { eq } from "drizzle-orm";
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
  payoutRequests
} from "./schema";

export async function runSeed() {
  console.log("🌱 Seeding Orochia database with realistic users, Bunny collections, 4K streams, and financial ledger...");

  // 1. Seed Admin User
  const [adminUser] = await db
    .insert(users)
    .values({
      email: "admin@orochia.org",
      username: "orochia_admin",
      passwordHash: hashPassword("admin1234"),
      role: "ADMIN",
      isVerified: true,
      isAgeVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  if (adminUser) {
    await db.insert(profiles).values({
      userId: adminUser.id,
      displayName: "Orochia Protocol Admin",
      bio: "Global platform supervisor, 18 U.S.C. § 2257 compliance custodian & treasury operator.",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
      totalViews: 0,
      totalTipsEarnedCents: 0,
    });
  }

  // 2. Seed Sovereign Creators
  const [creatorElena] = await db
    .insert(users)
    .values({
      email: "elena@orochia.org",
      username: "elenavox",
      passwordHash: hashPassword("elena1234"),
      role: "CREATOR",
      isVerified: true,
      isAgeVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  const [creatorMia] = await db
    .insert(users)
    .values({
      email: "mia@orochia.org",
      username: "miasterling",
      passwordHash: hashPassword("mia1234"),
      role: "CREATOR",
      isVerified: true,
      isAgeVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  // 3. Seed Sanctuary Patron (Consumer)
  const [patronAlex] = await db
    .insert(users)
    .values({
      email: "alex@sanctuary.io",
      username: "alex_vance",
      passwordHash: hashPassword("alex1234"),
      role: "MEMBER",
      isVerified: true,
      isAgeVerified: true,
    })
    .onConflictDoNothing()
    .returning();

  // Profiles
  if (creatorElena) {
    await db.insert(profiles).values({
      userId: creatorElena.id,
      displayName: "Elena Vox",
      bio: "Visual artist, nocturnal producer & independent 4K cinema director. Supported 100% directly by sovereign patrons.",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      bannerUrl: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=80",
      twitterHandle: "elenavox_live",
      minTipAmountCents: 1000,
      payoutAddressCrypto: "TLvQZ9oP3x84Ujk7Yv9LKm82qNx (USDT-TRC20)",
      payoutAccountCcbill: "951004-0012",
      totalViews: 142800,
      totalTipsEarnedCents: 482500, // $4,825.00 total
    });
  }

  if (creatorMia) {
    await db.insert(profiles).values({
      userId: creatorMia.id,
      displayName: "Mia Sterling",
      bio: "Acoustic lounge vocalist and intimate late-night streaming composer.",
      avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80",
      bannerUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80",
      twitterHandle: "miasterling",
      minTipAmountCents: 500,
      payoutAddressCrypto: "0x3B88...19fE (ETH)",
      totalViews: 68400,
      totalTipsEarnedCents: 194000,
    });
  }

  if (patronAlex) {
    await db.insert(profiles).values({
      userId: patronAlex.id,
      displayName: "Alex Vance",
      bio: "Sanctuary Patron of independent cinema, 4K digital art, and underground sound design.",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
      totalViews: 42,
      totalTipsEarnedCents: 0,
    });
  }

  // 4. Seed Bunny Collections (Playlists)
  let elena = creatorElena;
  if (!elena) {
    const found = await db.select().from(users).where(eq(users.username, "elenavox")).limit(1);
    elena = found[0];
  }

  let alex = patronAlex;
  if (!alex) {
    const found = await db.select().from(users).where(eq(users.username, "alex_vance")).limit(1);
    alex = found[0];
  }

  const elenaId = elena?.id;
  if (elenaId) {
    const [neonCollection] = await db
      .insert(playlists)
      .values({
        creatorId: elenaId,
        title: "Tokyo Neon Nights [Bunny Collection col-tokyo-4k]",
        description: "Official 4K episodic documentary on Tokyo underground nightlife and art lounges.",
        isPrivate: false,
      })
      .returning();

    const [vaultCollection] = await db
      .insert(playlists)
      .values({
        creatorId: elenaId,
        title: "Velvet Private Vault [Bunny Collection col-vault-uncut]",
        description: "Exclusive unreleased performance recordings and private patron streams.",
        isPrivate: true,
      })
      .returning();

    let pubVideo = (
      await db
        .insert(videos)
        .values({
          creatorId: elenaId,
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
          tags: ["cinematic", "tokyo", "4k", "neon"],
          resolutions: ["2160p", "1080p", "720p"],
        })
        .onConflictDoNothing()
        .returning()
    )[0];

    if (!pubVideo) {
      const found = await db.select().from(videos).where(eq(videos.bunnyVideoId, "9b3c4a12-8819-4820-a6fe-b715a3e144bb")).limit(1);
      pubVideo = found[0];
    }

    let tipVideo = (
      await db
        .insert(videos)
        .values({
          creatorId: elenaId,
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
          tags: ["uncut", "exclusive", "directors-cut", "vault"],
          resolutions: ["2160p", "1080p", "720p"],
        })
        .onConflictDoNothing()
        .returning()
    )[0];

    if (!tipVideo) {
      const found = await db.select().from(videos).where(eq(videos.bunnyVideoId, "2d7f8c91-9921-4d30-b2aa-c819a5f255cc")).limit(1);
      tipVideo = found[0];
    }

    const vidPublic = pubVideo;
    const vidTipped = tipVideo;

    // Link videos into Bunny playlists
    if (neonCollection && vidPublic) {
      await db.insert(playlistItems).values({
        playlistId: neonCollection.id,
        videoId: vidPublic.id,
        position: 0,
      }).onConflictDoNothing();
    }
    if (vaultCollection && vidTipped) {
      await db.insert(playlistItems).values({
        playlistId: vaultCollection.id,
        videoId: vidTipped.id,
        position: 0,
      }).onConflictDoNothing();
    }

    // 6. Seed Access Grant (Alex unlocked Elena's private session)
    if (alex && vidTipped) {
      await db.insert(videoAccessGrants).values({
        videoId: vidTipped.id,
        userId: alex.id,
        grantedVia: "TIP_PAYMENT",
        amountPaidCents: 1000,
        transactionRef: "tx-ccbill-9941a8",
      }).onConflictDoNothing();

      // 7. Seed Financial Ledger (90% Creator, 10% Platform Rake)
      await db.insert(tipsLedger).values({
        entryType: "TIP_RECEIVED",
        senderId: alex.id,
        creatorId: elenaId,
        videoId: vidTipped.id,
        grossAmountCents: 1000,
        platformFeeCents: 100, // 10% Platform Rake
        netAmountCents: 900,   // 90% Sovereign Creator
        gateway: "CCBILL",
        gatewayTransactionRef: "tx-ccbill-9941a8",
        note: "Director cut unlock tip",
      });
    }

    // 8. Seed Creator Payout Request
    await db.insert(payoutRequests).values({
      creatorId: elenaId,
      amountCents: 25000, // $250.00
      status: "REQUESTED",
      payoutMethod: "CRYPTO_USDT",
      payoutDestination: "TLvQZ9oP3x84Ujk7Yv9LKm82qNx (USDT-TRC20)",
    });
  }

  console.log("✅ Rich DevX Seed successfully completed with Admin, Creators, Patron, Bunny Collections, and Ledger records!");
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seed error:", err);
      process.exit(1);
    });
}
