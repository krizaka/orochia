/** The three ways to start a challenge, as the cards say them and the address asks for them (`/challenges?new=<slug>`). */
export const CHALLENGE_STARTS = [
  { slug: "goal", kind: "GOAL", messageKey: "goal" },
  { slug: "dare", kind: "REQUEST", messageKey: "dare" },
  { slug: "call", kind: "OPEN_CALL", messageKey: "openCall" },
] as const;

export type ChallengeStartSlug = (typeof CHALLENGE_STARTS)[number]["slug"];

export const challengeStartHref = (slug: ChallengeStartSlug) => `/challenges?new=${slug}`;

/** The composer kind a `?new=` value asks for, or null. */
export function challengeKindFromSlug(slug: string | undefined) {
  return CHALLENGE_STARTS.find((s) => s.slug === slug)?.kind ?? null;
}
