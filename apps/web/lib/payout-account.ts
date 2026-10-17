import crypto from "crypto";
import { db, payoutAccounts } from "@orochia/db";
import { eq } from "drizzle-orm";
import { payoutEncryptionKey } from "./env";
import { HttpError } from "./http";

/**
 * Where a creator is paid. The details are checked the way banks check them (IBAN mod-97, ABA routing checksum,
 * address formats), encrypted at rest with AES-256-GCM, and shown only as a masked hint. A payout request keeps an
 * encrypted snapshot of the account it was requested to; operators read it decrypted (admin payouts).
 */

export const PAYOUT_METHODS = ["BANK_IBAN", "BANK_US", "BANK_CA", "PAYPAL", "CRYPTO_USDT_TRC20", "CRYPTO_BTC"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];
type Details = Record<string, string>;

// ── Encryption ──────────────────────────────────────────────────────────────────────────────────

const PREFIX = "enc:v1:";
const keyOf = () => crypto.createHash("sha256").update(payoutEncryptionKey()).digest();

export function sealDetails(details: object): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyOf(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(details), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The details behind a sealed value; a value written before encryption existed is returned as it is. */
export function openDetails(value: string): Details | string {
  if (!value.startsWith(PREFIX)) return value;
  const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyOf(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8")) as Details;
}

// ── Validation ──────────────────────────────────────────────────────────────────────────────────

const digits = (v: string) => v.replace(/[\s-]/g, "");

export function validIban(input: string): boolean {
  const iban = input.replace(/\s/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const moved = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of moved) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}

export function validAbaRouting(input: string): boolean {
  const r = digits(input);
  if (!/^\d{9}$/.test(r)) return false;
  const d = r.split("").map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

const last4 = (v: string) => v.replace(/\s/g, "").slice(-4);

/** Checks the details of a method; returns them normalised with a masked hint, or throws a 400 that says what is wrong. */
export function checkPayoutDetails(method: PayoutMethod, input: Details): { details: Details; hint: string } {
  const v = (k: string) => (input[k] ?? "").trim();
  const fail = (field: string) => {
    throw new HttpError(400, `Check the ${field}`);
  };
  switch (method) {
    case "BANK_IBAN": {
      const iban = v("iban").replace(/\s/g, "").toUpperCase();
      if (!validIban(iban)) fail("IBAN");
      const bic = v("bic").toUpperCase();
      if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) fail("BIC / SWIFT code");
      return { details: { iban, ...(bic ? { bic } : {}) }, hint: `IBAN ${iban.slice(0, 2)} •••• ${last4(iban)}` };
    }
    case "BANK_US": {
      const routing = digits(v("routingNumber"));
      const account = digits(v("accountNumber"));
      if (!validAbaRouting(routing)) fail("routing number");
      if (!/^\d{4,17}$/.test(account)) fail("account number");
      const type = v("accountType") === "savings" ? "savings" : "checking";
      return { details: { routingNumber: routing, accountNumber: account, accountType: type }, hint: `US bank •••• ${last4(account)}` };
    }
    case "BANK_CA": {
      const transit = digits(v("transitNumber"));
      const institution = digits(v("institutionNumber"));
      const account = digits(v("accountNumber"));
      if (!/^\d{5}$/.test(transit)) fail("transit number");
      if (!/^\d{3}$/.test(institution)) fail("institution number");
      if (!/^\d{7,12}$/.test(account)) fail("account number");
      return { details: { transitNumber: transit, institutionNumber: institution, accountNumber: account }, hint: `Canadian bank •••• ${last4(account)}` };
    }
    case "PAYPAL": {
      const email = v("email").toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fail("PayPal e-mail");
      const [name, domain] = email.split("@");
      return { details: { email }, hint: `PayPal ${name.slice(0, 2)}•••@${domain}` };
    }
    case "CRYPTO_USDT_TRC20": {
      const address = v("address");
      if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) fail("TRC-20 address");
      return { details: { address }, hint: `USDT ${address.slice(0, 4)}…${address.slice(-4)}` };
    }
    case "CRYPTO_BTC": {
      const address = v("address");
      if (!/^(bc1[02-9ac-hj-np-z]{11,71}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(address)) fail("Bitcoin address");
      return { details: { address }, hint: `BTC ${address.slice(0, 4)}…${address.slice(-4)}` };
    }
  }
}

// ── Store ───────────────────────────────────────────────────────────────────────────────────────

export interface PayoutAccountView {
  method: PayoutMethod;
  holderName: string;
  country: string;
  hint: string;
  updatedAt: Date;
}

export async function getPayoutAccount(userId: string): Promise<PayoutAccountView | null> {
  const [row] = await db.select().from(payoutAccounts).where(eq(payoutAccounts.userId, userId)).limit(1);
  return row ? { method: row.method as PayoutMethod, holderName: row.holderName, country: row.country, hint: row.displayHint, updatedAt: row.updatedAt } : null;
}

/** Saves (or replaces) the account; only the masked hint ever comes back. */
export async function savePayoutAccount(userId: string, input: { method: PayoutMethod; holderName: string; country: string; details: Details }): Promise<PayoutAccountView> {
  const holderName = input.holderName.trim();
  if (holderName.length < 2) throw new HttpError(400, "Check the account holder's name");
  const country = input.country.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new HttpError(400, "Check the country");
  const { details, hint } = checkPayoutDetails(input.method, input.details);
  const values = { method: input.method, holderName, country, detailsEncrypted: sealDetails({ holderName, country, ...details }), displayHint: hint, updatedAt: new Date() };
  await db.insert(payoutAccounts).values({ userId, ...values }).onConflictDoUpdate({ target: payoutAccounts.userId, set: values });
  return { method: input.method, holderName, country, hint, updatedAt: values.updatedAt };
}

/** The sealed snapshot a payout request keeps (method + encrypted details), or a 400 when none is set. */
export async function payoutDestinationOf(userId: string): Promise<{ method: PayoutMethod; sealed: string }> {
  const [row] = await db.select().from(payoutAccounts).where(eq(payoutAccounts.userId, userId)).limit(1);
  if (!row) throw new HttpError(400, "Add where to send your money first");
  return { method: row.method as PayoutMethod, sealed: row.detailsEncrypted };
}
