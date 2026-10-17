import { randomInt } from "node:crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** `base_xxxx` for the day base, base2…base99 are all taken: 4 random characters from the CSPRNG, and the base cut so the whole
 *  stays within the 30 characters of a username (a 26-character base plus `_xxxx` was 31). */
export function usernameWithSuffix(base: string): string {
  const suffix = Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${base.slice(0, 25)}_${suffix}`;
}
