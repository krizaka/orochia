import crypto from "crypto";
import { db, userInvitations, users, profiles, contacts } from "@orochia/db";
import { and, desc, eq, gt, or, sql } from "drizzle-orm";
import { appUrl } from "./env";
import { sendTemplate } from "./mail";
import { HttpError } from "./http";

/** How long an invitation link works. */
const INVITATION_DAYS = 7;

export interface InvitationView {
  id: string;
  email: string;
  code: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  inviteUrl: string;
}

/**
 * Creates an invitation to join Orochia, saves it to the database,
 * and sends an invite email to the recipient.
 */
export async function createInvitation(inviterId: string, targetEmail: string): Promise<InvitationView> {
  const email = targetEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Invalid email address");
  }

  // Check if target is already an active user
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);
  if (existingUser) {
    throw new HttpError(400, "This email already belongs to a registered user");
  }

  // Fetch inviter info for email
  const [inviter] = await db
    .select({
      username: users.username,
      displayName: sql<string>`coalesce(${profiles.displayName}, ${users.username})`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.id, inviterId))
    .limit(1);

  const code = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(userInvitations)
    .values({
      inviterId,
      email,
      code,
      status: "PENDING",
      expiresAt,
    })
    .returning();

  const inviteUrl = `${appUrl()}/auth/register?invite=${code}`;

  // Send invitation email
  const inviterUsername = inviter?.username ?? "";
  await sendTemplate("invitation", {
    to: email,
    vars: { inviterName: inviter?.displayName || `@${inviterUsername}`, inviterUsername, link: inviteUrl, expiresInDays: INVITATION_DAYS },
  });

  return {
    id: row.id,
    email: row.email,
    code: row.code,
    status: row.status,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    createdAt: row.createdAt,
    inviteUrl,
  };
}

/** Lists invitations sent by a user. */
export async function listUserInvitations(inviterId: string): Promise<InvitationView[]> {
  const rows = await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.inviterId, inviterId))
    .orderBy(desc(userInvitations.createdAt));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    code: r.code,
    status: r.expiresAt.getTime() < Date.now() && r.status === "PENDING" ? "EXPIRED" : r.status,
    expiresAt: r.expiresAt,
    acceptedAt: r.acceptedAt,
    createdAt: r.createdAt,
    inviteUrl: `${appUrl()}/auth/register?invite=${r.code}`,
  }));
}

/**
 * Accepts an invitation when a newly registered user completes registration with an invite code.
 * Automatically marks the invitation accepted and creates an accepted contact relation with the inviter.
 */
export async function acceptInvitation(code: string, newUserId: string): Promise<void> {
  const cleanCode = code.trim();
  if (!cleanCode) return;

  const [invitation] = await db
    .select()
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.code, cleanCode),
        eq(userInvitations.status, "PENDING"),
        gt(userInvitations.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!invitation) return;

  await db.transaction(async (tx) => {
    await tx
      .update(userInvitations)
      .set({
        status: "ACCEPTED",
        acceptedAt: new Date(),
      })
      .where(eq(userInvitations.id, invitation.id));

    // Create mutual accepted contact relationship between inviter and new user
    const [existingContact] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        or(
          and(eq(contacts.requesterId, invitation.inviterId), eq(contacts.addresseeId, newUserId)),
          and(eq(contacts.requesterId, newUserId), eq(contacts.addresseeId, invitation.inviterId))
        )
      )
      .limit(1);

    if (!existingContact) {
      await tx.insert(contacts).values({
        requesterId: invitation.inviterId,
        addresseeId: newUserId,
        status: "ACCEPTED",
      });
    }
  });
}
