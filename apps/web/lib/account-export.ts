/**
 * Law 25 portability of an account, for an operator who received the request: everything Orochia holds *about* the
 * account, in one JSON document. The password hash, the sessions' tokens, the payout destination and other people's
 * words are never in it: a message is its conversation's, a comment its thread's. Money is integer cents.
 */

export interface ExportRows {
  user: { id: string; email: string; username: string; role: string; isVerified: boolean; isAgeVerified: boolean; dateOfBirth: string | null; emailVerifiedAt: Date | null; suspendedAt: Date | null; createdAt: Date; lastSeenAt: Date | null };
  profile: { displayName: string | null; bio: string | null; websiteUrl: string | null; socialLinks: Record<string, string>; minTipAmountCents: number; createdAt?: Date } | null;
  videos: { id: string; title: string; description: string | null; visibility: string; status: string; viewsCount: number; tipsCount: number; createdAt: Date; removedAt: Date | null; removalReason: string | null }[];
  tipsSent: { id: string; videoId: string | null; creatorId: string; grossAmountCents: number; note: string | null; createdAt: Date }[];
  tipsReceived: { id: string; videoId: string | null; grossAmountCents: number; platformFeeCents: number; netAmountCents: number; createdAt: Date }[];
  wallet: { entryType: string; amountCents: number; reference: string; note: string | null; createdAt: Date }[];
  payouts: { id: string; amountCents: number; status: string; payoutMethod: string; createdAt: Date; settledAt: Date | null }[];
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function shapeExport(rows: ExportRows, now = new Date()): Record<string, unknown> {
  const { user, profile } = rows;
  return {
    format: "orochia-account-export/1",
    exportedAt: now.toISOString(),
    account: { id: user.id, email: user.email, username: user.username, role: user.role, isVerified: user.isVerified, isAgeVerified: user.isAgeVerified, dateOfBirth: user.dateOfBirth, emailVerifiedAt: iso(user.emailVerifiedAt), suspendedAt: iso(user.suspendedAt), createdAt: iso(user.createdAt), lastSeenAt: iso(user.lastSeenAt) },
    profile: profile ? { displayName: profile.displayName, bio: profile.bio, websiteUrl: profile.websiteUrl, socialLinks: profile.socialLinks, minTipAmountCents: profile.minTipAmountCents } : null,
    videos: rows.videos.map((v) => ({ id: v.id, title: v.title, description: v.description, visibility: v.visibility, status: v.status, viewsCount: v.viewsCount, tipsCount: v.tipsCount, createdAt: iso(v.createdAt), removedAt: iso(v.removedAt), removalReason: v.removalReason })),
    tipsSent: rows.tipsSent.map((t) => ({ id: t.id, videoId: t.videoId, creatorId: t.creatorId, grossAmountCents: t.grossAmountCents, note: t.note, createdAt: iso(t.createdAt) })),
    tipsReceived: rows.tipsReceived.map((t) => ({ id: t.id, videoId: t.videoId, grossAmountCents: t.grossAmountCents, platformFeeCents: t.platformFeeCents, netAmountCents: t.netAmountCents, createdAt: iso(t.createdAt) })),
    wallet: rows.wallet.map((w) => ({ entryType: w.entryType, amountCents: w.amountCents, reference: w.reference, note: w.note, createdAt: iso(w.createdAt) })),
    payouts: rows.payouts.map((p) => ({ id: p.id, amountCents: p.amountCents, status: p.status, payoutMethod: p.payoutMethod, createdAt: iso(p.createdAt), settledAt: iso(p.settledAt) })),
  };
}

/** Reads the rows of one account (or null when there is none). */
export async function loadExportRows(userId: string): Promise<ExportRows | null> {
  const { db, users, profiles, videos, tipsLedger, walletLedger, payoutRequests } = await import("@orochia/db");
  const { desc, eq } = await import("drizzle-orm");
  const [user] = await db
    .select({ id: users.id, email: users.email, username: users.username, role: users.role, isVerified: users.isVerified, isAgeVerified: users.isAgeVerified, dateOfBirth: users.dateOfBirth, emailVerifiedAt: users.emailVerifiedAt, suspendedAt: users.suspendedAt, createdAt: users.createdAt, lastSeenAt: users.lastSeenAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return null;
  const [profile] = await db.select({ displayName: profiles.displayName, bio: profiles.bio, websiteUrl: profiles.websiteUrl, socialLinks: profiles.socialLinks, minTipAmountCents: profiles.minTipAmountCents }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  const [vids, sent, received, wallet, payouts] = await Promise.all([
    db.select({ id: videos.id, title: videos.title, description: videos.description, visibility: videos.visibility, status: videos.status, viewsCount: videos.viewsCount, tipsCount: videos.tipsCount, createdAt: videos.createdAt, removedAt: videos.removedAt, removalReason: videos.removalReason }).from(videos).where(eq(videos.creatorId, userId)).orderBy(desc(videos.createdAt)),
    db.select({ id: tipsLedger.id, videoId: tipsLedger.videoId, creatorId: tipsLedger.creatorId, grossAmountCents: tipsLedger.grossAmountCents, note: tipsLedger.note, createdAt: tipsLedger.createdAt }).from(tipsLedger).where(eq(tipsLedger.senderId, userId)).orderBy(desc(tipsLedger.createdAt)),
    db.select({ id: tipsLedger.id, videoId: tipsLedger.videoId, grossAmountCents: tipsLedger.grossAmountCents, platformFeeCents: tipsLedger.platformFeeCents, netAmountCents: tipsLedger.netAmountCents, createdAt: tipsLedger.createdAt }).from(tipsLedger).where(eq(tipsLedger.creatorId, userId)).orderBy(desc(tipsLedger.createdAt)),
    db.select({ entryType: walletLedger.entryType, amountCents: walletLedger.amountCents, reference: walletLedger.reference, note: walletLedger.note, createdAt: walletLedger.createdAt }).from(walletLedger).where(eq(walletLedger.userId, userId)).orderBy(desc(walletLedger.createdAt)),
    db.select({ id: payoutRequests.id, amountCents: payoutRequests.amountCents, status: payoutRequests.status, payoutMethod: payoutRequests.payoutMethod, createdAt: payoutRequests.createdAt, settledAt: payoutRequests.settledAt }).from(payoutRequests).where(eq(payoutRequests.creatorId, userId)).orderBy(desc(payoutRequests.createdAt)),
  ]);
  return { user: { ...user, dateOfBirth: user.dateOfBirth ?? null }, profile: profile ?? null, videos: vids, tipsSent: sent, tipsReceived: received, wallet, payouts };
}
