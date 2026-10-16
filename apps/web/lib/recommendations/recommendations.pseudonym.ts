import { createHmac } from "node:crypto";

import type { Pseudonym } from "./recommendations.types";

/**
 * The person as Orazaka knows them: `HMAC-SHA256(AI_PSEUDONYM_KEY, accountId)`, hex. Stable (the same account is the same
 * pseudonym, so its profile builds up), not reversible without the key (Orazaka never learns the account id), and
 * recomputable by Orochia alone (an erasure names the same pseudonym). Rotating the key forgets every profile.
 */
export function pseudonymOf(accountId: string, key: string): Pseudonym {
  return createHmac("sha256", key).update(`orochia-account:${accountId}`).digest("hex") as Pseudonym;
}
