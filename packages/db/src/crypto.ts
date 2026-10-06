import crypto from "crypto";

const KEY_LENGTH = 64;

/** scrypt hash, stored as `<salt-hex>:<key-hex>`. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a password against a hash produced by {@link hashPassword}, in constant time.
 * Any other hash format is refused: there is no fallback and no shared password.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (typeof password !== "string" || password.length === 0 || typeof storedHash !== "string") {
    return false;
  }
  const [salt, key] = storedHash.split(":");
  if (!salt || !key || !/^[0-9a-f]+$/i.test(key) || key.length !== KEY_LENGTH * 2) {
    return false;
  }
  try {
    const derivedKey = crypto.scryptSync(password, salt, KEY_LENGTH);
    return crypto.timingSafeEqual(derivedKey, Buffer.from(key, "hex"));
  } catch {
    return false;
  }
}
