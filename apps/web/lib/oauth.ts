import crypto from "crypto";
import { db, users, profiles, authIdentities, hashPassword } from "@orochia/db";
import { and, eq, sql } from "drizzle-orm";
import { appUrl, sessionSecret } from "./env";
import { HttpError } from "./http";
import type { SessionUser } from "./auth";

/**
 * Sign in with Google or Facebook — OAuth 2 authorization code with PKCE, plain fetch, no SDK. A provider is
 * offered only when its keys are set (GOOGLE_CLIENT_ID/SECRET, FACEBOOK_APP_ID/SECRET). The provider's user id
 * is the key of an identity; a new person completes their account (username, date of birth, 18+ certification, terms) before
 * it is created, because those certifications are personal and cannot come from a provider.
 */

export const OAUTH_PROVIDERS = ["google", "facebook"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  scope: string;
}

type Env = Record<string, string | undefined>;

export function providerConfig(provider: OAuthProvider, env: Env = process.env): ProviderConfig | null {
  if (provider === "google" && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      scope: "openid email profile",
    };
  }
  if (provider === "facebook" && env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET) {
    return {
      clientId: env.FACEBOOK_APP_ID,
      clientSecret: env.FACEBOOK_APP_SECRET,
      authorizeUrl: "https://www.facebook.com/v19.0/dialog/oauth",
      scope: "email,public_profile",
    };
  }
  return null;
}

export function configuredProviders(env: Env = process.env): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((p) => providerConfig(p, env) !== null);
}

export const callbackUrl = (provider: OAuthProvider) => `${appUrl()}/api/auth/oauth/${provider}/callback`;

// ── Signed, short-lived cookies (state + PKCE verifier; the pending profile) ────────────────────

export const OAUTH_STATE_COOKIE = "orochia_oauth";
export const OAUTH_PENDING_COOKIE = "orochia_oauth_pending";

const b64 = (b: Buffer) => b.toString("base64url");
const mac = (data: string, secret: string) => b64(crypto.createHmac("sha256", secret).update(data).digest());

export function seal(payload: object, ttlSeconds: number, secret = sessionSecret(), now = Date.now()): string {
  const data = b64(Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + ttlSeconds })));
  return `${data}.${mac(data, secret)}`;
}

export function unseal<T>(value: string | undefined, secret = sessionSecret(), now = Date.now()): T | null {
  if (!value) return null;
  const [data, signature] = value.split(".");
  if (!data || !signature) return null;
  const expected = Buffer.from(mac(data, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T & { exp: number };
    return payload.exp * 1000 > now ? payload : null;
  } catch {
    return null;
  }
}

export interface OAuthState {
  provider: OAuthProvider;
  state: string;
  verifier: string;
  next: string;
}

/** Only same-site paths are honoured after sign-in. */
export const safeNext = (next: string | null | undefined) => (next && /^\/(?!\/)/.test(next) ? next : "/");

/** The provider's consent URL, and the state to keep in a cookie until the callback. */
export function startAuthorization(provider: OAuthProvider, next: string | null) {
  const config = providerConfig(provider);
  if (!config) throw new HttpError(404, "Sign-in provider not available");
  const state = b64(crypto.randomBytes(24));
  const verifier = b64(crypto.randomBytes(32));
  const challenge = b64(crypto.createHash("sha256").update(verifier).digest());
  const url = new URL(config.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl(provider),
    response_type: "code",
    scope: config.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    ...(provider === "google" ? { prompt: "select_account" } : {}),
  }).toString();
  return { url: url.toString(), cookie: seal({ provider, state, verifier, next: safeNext(next) } satisfies OAuthState, 600) };
}

export interface ProviderProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string | null;
  /** The provider vouches for the address (Google: email_verified; Facebook only returns confirmed ones). */
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

/** Exchanges the code (with the PKCE verifier) and reads who signed in. */
export async function fetchProfile(provider: OAuthProvider, code: string, verifier: string): Promise<ProviderProfile> {
  const config = providerConfig(provider);
  if (!config) throw new HttpError(404, "Sign-in provider not available");
  const params = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: callbackUrl(provider),
    code,
    code_verifier: verifier,
  };

  if (provider === "google") {
    const token = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...params, grant_type: "authorization_code" }),
      signal: AbortSignal.timeout(10000),
    });
    if (!token.ok) throw new HttpError(502, "Google did not confirm the sign-in");
    const { access_token } = (await token.json()) as { access_token: string };
    const info = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!info.ok) throw new HttpError(502, "Google profile unavailable");
    const p = (await info.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    return { provider, providerUserId: p.sub, email: p.email?.toLowerCase() ?? null, emailVerified: p.email_verified === true, name: p.name ?? null, avatarUrl: p.picture ?? null };
  }

  const token = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(10000) });
  if (!token.ok) throw new HttpError(502, "Facebook did not confirm the sign-in");
  const { access_token } = (await token.json()) as { access_token: string };
  const me = await fetch(`https://graph.facebook.com/v19.0/me?${new URLSearchParams({ fields: "id,name,email,picture.width(400)", access_token })}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!me.ok) throw new HttpError(502, "Facebook profile unavailable");
  const p = (await me.json()) as { id: string; name?: string; email?: string; picture?: { data?: { url?: string } } };
  return { provider, providerUserId: p.id, email: p.email?.toLowerCase() ?? null, emailVerified: Boolean(p.email), name: p.name ?? null, avatarUrl: p.picture?.data?.url ?? null };
}

const PROVIDER_ENUM = { google: "GOOGLE", facebook: "FACEBOOK" } as const;

function sessionOf(row: typeof users.$inferSelect): SessionUser {
  return { id: row.id, username: row.username, email: row.email, role: row.role, isAgeVerified: row.isAgeVerified, emailVerified: Boolean(row.emailVerifiedAt) };
}

/**
 * Who this provider sign-in is: an account already linked to it, or an account with the same address the
 * provider vouches for (linked now) — otherwise a new person, who completes their account first.
 */
export async function resolveSignIn(profile: ProviderProfile): Promise<{ kind: "signedIn"; user: SessionUser } | { kind: "needsCompletion" }> {
  const provider = PROVIDER_ENUM[profile.provider];
  const [linked] = await db
    .select({ user: users })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUserId, profile.providerUserId)))
    .limit(1);
  let account = linked?.user ?? null;

  if (!account && profile.email && profile.emailVerified) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1);
    if (byEmail) {
      await db.insert(authIdentities).values({ userId: byEmail.id, provider, providerUserId: profile.providerUserId, email: profile.email }).onConflictDoNothing();
      account = byEmail;
    }
  }
  if (!account) return { kind: "needsCompletion" };
  if (account.suspendedAt) throw new HttpError(403, "This account is suspended. Contact the platform operator.");

  // The provider proved the address: a still-unverified account becomes verified.
  const [fresh] = await db
    .update(users)
    .set({ emailVerifiedAt: profile.emailVerified && profile.email === account.email ? sql`coalesce(${users.emailVerifiedAt}, now())` : users.emailVerifiedAt })
    .where(eq(users.id, account.id))
    .returning();
  await db
    .update(authIdentities)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUserId, profile.providerUserId)));
  return { kind: "signedIn", user: sessionOf(fresh) };
}

export interface Completion {
  username: string;
  displayName: string;
  /** Only when the provider gave no address (some Facebook accounts): it is then verified by e-mail. */
  email?: string | null;
  /** Checked 18+ by the caller (checkDateOfBirth). */
  dateOfBirth: string;
}

/** Creates the account of a new provider sign-in (a member), linked to the provider. */
export async function completeSignUp(profile: ProviderProfile, input: Completion): Promise<{ user: SessionUser; needsEmailVerification: boolean }> {
  const email = (profile.email ?? input.email ?? "").toLowerCase();
  if (!email) throw new HttpError(400, "An e-mail address is required");
  const verified = Boolean(profile.email && profile.emailVerified);
  const row = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        username: input.username,
        email,
        // No password: the account signs in with its provider (and can set one with "forgot password").
        passwordHash: hashPassword(crypto.randomBytes(32).toString("base64url")),
        role: "MEMBER",
        isVerified: true,
        isAgeVerified: true,
        dateOfBirth: input.dateOfBirth,
        emailVerifiedAt: verified ? new Date() : null,
      })
      .returning();
    await tx.insert(profiles).values({ userId: user.id, displayName: input.displayName, avatarUrl: profile.avatarUrl });
    await tx.insert(authIdentities).values({ userId: user.id, provider: PROVIDER_ENUM[profile.provider], providerUserId: profile.providerUserId, email });
    return user;
  });
  return { user: sessionOf(row), needsEmailVerification: !verified };
}

/** A free username from the provider's name, as a suggestion for the completion form. */
export function suggestUsername(profile: ProviderProfile): string {
  const base = (profile.name ?? profile.email?.split("@")[0] ?? "member")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return (base.length >= 3 ? base : `member_${base}`).slice(0, 24);
}
