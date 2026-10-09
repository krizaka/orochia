import { HttpError } from "./http";
import { DEFAULT_AVATARS, DEFAULT_BANNERS } from "./presets";
import { publicUrlForRef } from "./storage";

/**
 * The rules of a profile: which networks can be linked (handles in, URLs built here — a profile never carries
 * a link the server did not build), where its pictures may come from, the 18+ rule on the date of birth, and
 * the e-mail notifications an account can turn off.
 */

// ── Links ───────────────────────────────────────────────────────────────────────────────────────

const HANDLE = /^[A-Za-z0-9._-]{1,60}$/;

export const SOCIAL_NETWORKS = {
  instagram: { url: (h: string) => `https://instagram.com/${h}`, hosts: ["instagram.com"] },
  x: { url: (h: string) => `https://x.com/${h}`, hosts: ["x.com", "twitter.com"] },
  facebook: { url: (h: string) => `https://facebook.com/${h}`, hosts: ["facebook.com", "fb.com"] },
  tiktok: { url: (h: string) => `https://tiktok.com/@${h}`, hosts: ["tiktok.com"] },
  youtube: { url: (h: string) => `https://youtube.com/@${h}`, hosts: ["youtube.com"] },
  telegram: { url: (h: string) => `https://t.me/${h}`, hosts: ["t.me", "telegram.me"] },
} as const;
export type SocialNetwork = keyof typeof SOCIAL_NETWORKS;
export const SOCIAL_NETWORK_IDS = Object.keys(SOCIAL_NETWORKS) as SocialNetwork[];

/** A handle from what was typed: "@name", "name" or a link to that network. Null when empty; 400 when not a handle. */
export function normalizeHandle(network: SocialNetwork, input: string | null | undefined): string | null {
  let value = (input ?? "").trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || /^(www\.)?[a-z0-9.-]+\.[a-z]{2,}\//i.test(value)) {
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      throw new HttpError(400, `Invalid ${network} link`);
    }
    const host = url.hostname.replace(/^(www\.|m\.)/, "");
    if (!(SOCIAL_NETWORKS[network].hosts as readonly string[]).includes(host)) throw new HttpError(400, `That is not a ${network} link`);
    value = url.pathname.split("/").filter(Boolean)[0] ?? "";
  }
  value = value.replace(/^@/, "");
  if (!HANDLE.test(value)) throw new HttpError(400, `Invalid ${network} handle`);
  return value;
}

export function parseSocialLinks(input: Partial<Record<string, string | null>> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const network of SOCIAL_NETWORK_IDS) {
    const handle = normalizeHandle(network, input?.[network]);
    if (handle) out[network] = handle;
  }
  return out;
}

/** The links shown on a profile, built from stored handles. */
export function socialLinksView(stored: unknown): { network: SocialNetwork; handle: string; url: string }[] {
  const links = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  return SOCIAL_NETWORK_IDS.flatMap((network) => {
    const handle = links[network];
    return typeof handle === "string" && HANDLE.test(handle) ? [{ network, handle, url: SOCIAL_NETWORKS[network].url(handle) }] : [];
  });
}

/** A personal website: http(s) only, normalised. Null when empty. */
export function normalizeWebsite(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new HttpError(400, "Invalid website address");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new HttpError(400, "The website must start with https://");
  if (!url.hostname.includes(".")) throw new HttpError(400, "Invalid website address");
  return url.toString().slice(0, 200);
}

// ── Pictures ────────────────────────────────────────────────────────────────────────────────────

const UPLOADED = /^(avatars|banners)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

/**
 * The URL a profile picture is stored with, from what the client chose: a preset id, an uploaded file's reference
 * (from /api/uploads) or the picture it already has. Anything else is refused — the client never sets a URL.
 */
export function profileImageUrl(kind: "avatar" | "banner", choice: string | null | undefined, current: string | null): string | null {
  if (choice === undefined) return current;
  if (choice === null || choice === "") return null;
  if (choice === current) return current;
  const preset = (kind === "avatar" ? DEFAULT_AVATARS : DEFAULT_BANNERS).find((p) => p.id === choice || p.url === choice);
  if (preset) return preset.url;
  if (UPLOADED.test(choice)) return publicUrlForRef(choice);
  throw new HttpError(400, `Choose a preset ${kind} or upload a picture`);
}

// ── Age ─────────────────────────────────────────────────────────────────────────────────────────

export const MINIMUM_AGE = 18;

/** Age in whole years on `today` of someone born on `isoDate` (YYYY-MM-DD). */
export function ageOn(isoDate: string, today = new Date()): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) age--;
  return age;
}

/** A date of birth from a form: a real date, in the past, at least 18 years ago (and not absurdly old). */
export function checkDateOfBirth(isoDate: string, today = new Date()): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  const date = match ? new Date(`${isoDate}T00:00:00Z`) : null;
  if (!match || !date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== isoDate) throw new HttpError(400, "Invalid date of birth");
  const age = ageOn(isoDate, today);
  if (age < MINIMUM_AGE) throw new HttpError(403, "Orochia is for adults only: you must be 18 or older.");
  if (age > 120) throw new HttpError(400, "Invalid date of birth");
  return isoDate;
}

// ── Notifications ───────────────────────────────────────────────────────────────────────────────

/** Every e-mail an account can receive about activity — all on by default, each can be turned off. */
export const NOTIFICATION_EVENTS = [
  "newFollower",
  "contactRequest",
  "newComment",
  "commentReply",
  "newMessage",
  "tipReceived",
  "videoUnlocked",
  "videoReady",
  "creatorPublished",
  "auctionAnnounced",
  "auctionNewBid",
  "auctionOutbid",
  "auctionWon",
  "auctionDecision",
  "auctionSold",
  "auctionUnsold",
  "auctionDeclined",
  "challengeAnnounced",
  "challengeRequested",
  "challengePledged",
  "challengeFunded",
  "challengeAccepted",
  "challengeApplied",
  "challengeChosen",
  "challengeDelivered",
  "challengeReleased",
  "challengeClosed",
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export function parseNotificationsOff(input: unknown): NotificationEvent[] {
  if (!Array.isArray(input)) return [];
  return NOTIFICATION_EVENTS.filter((e) => input.includes(e));
}
