import { db, pushDevices } from "@orochia/db";
import { sendExpoPush, isExpoPushToken } from "@orochia/push";
import { and, eq, inArray } from "drizzle-orm";

/**
 * Push to the account's phones (the Orochia app, krizaka/orochia-mobile). Called by `notify` after the notification
 * is written, so a push only ever repeats what the bell already shows; it follows the in-app preference of the event.
 * Best-effort: never throws, and forgets the tokens the push service reports as dead.
 *
 * EXPO_ACCESS_TOKEN (optional): with "enhanced push security" on in the Expo project, only this server may push to the
 * app's tokens. Like e-mail, pushes leave only in production, or elsewhere with PUSH_DELIVERY=on (local runs and CI never
 * call the push service).
 */
export function pushDeliveryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PUSH_DELIVERY === "on" || (env.NODE_ENV === "production" && env.PUSH_DELIVERY !== "off");
}

export async function pushToUser(userId: string, message: { title: string; body: string; path: string }): Promise<void> {
  if (!pushDeliveryEnabled()) return;
  try {
    const devices = await db.select({ token: pushDevices.token }).from(pushDevices).where(eq(pushDevices.userId, userId));
    if (devices.length === 0) return;
    const outcome = await sendExpoPush(
      devices.map((d) => ({ to: d.token, title: message.title, body: message.body, data: { path: message.path } })),
      { fetch: (url, init) => fetch(url, init), accessToken: process.env.EXPO_ACCESS_TOKEN || undefined },
    );
    if (outcome.deadTokens.length > 0) await db.delete(pushDevices).where(inArray(pushDevices.token, outcome.deadTokens));
    if (outcome.errors.length > 0) console.warn(`push: ${outcome.errors.length} failed for ${userId}: ${outcome.errors[0]}`);
  } catch (error) {
    console.error("push failed", error);
  }
}

/** Registers a phone for the account (moving the token from another account if the phone changed hands). */
export async function registerDevice(userId: string, token: string, platform: "ios" | "android"): Promise<boolean> {
  if (!isExpoPushToken(token)) return false;
  await db
    .insert(pushDevices)
    .values({ userId, token, platform })
    .onConflictDoUpdate({ target: pushDevices.token, set: { userId, platform, lastSeenAt: new Date() } });
  return true;
}

/** Forgets a phone (sign-out, or the user turned notifications off on the device). */
export async function unregisterDevice(userId: string, token: string): Promise<void> {
  await db.delete(pushDevices).where(and(eq(pushDevices.token, token), eq(pushDevices.userId, userId)));
}
