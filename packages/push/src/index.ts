/**
 * Mobile push, without an SDK: the Expo Push Service (https://exp.host/--/api/v2/push/send) relays to Firebase Cloud
 * Messaging on Android and to the Apple Push Notification service on iOS, from one HTTP call and one kind of token
 * (`ExponentPushToken[…]`). The FCM and APNs credentials live in the app's EAS project, never here.
 *
 * Pure and dependency-free: the caller passes `fetch` (tests pass a fake) and gets back which tokens are dead, so it
 * can forget them. Delivery is best-effort — a push never decides anything.
 */

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
/** The service takes at most 100 messages per request. */
export const EXPO_PUSH_BATCH = 100;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  /** Opened by the app when the notification is tapped (e.g. { path: "/challenges/<id>" }). */
  data?: Record<string, unknown>;
  /** Android channel, created by the app at start. */
  channelId?: string;
  sound?: "default" | null;
  badge?: number;
}

export interface PushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface PushOutcome {
  sent: number;
  /** Tokens the service says will never deliver again (uninstalled app, revoked permission): forget them. */
  deadTokens: string[];
  errors: string[];
}

/** Whether a string looks like an Expo push token. Anything else is refused before it is stored. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{8,}\]$/.test(token);
}

type Fetch = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Sends messages in batches of 100; never throws. */
export async function sendExpoPush(messages: PushMessage[], options: { fetch: Fetch; accessToken?: string }): Promise<PushOutcome> {
  const outcome: PushOutcome = { sent: 0, deadTokens: [], errors: [] };
  const valid = messages.filter((m) => isExpoPushToken(m.to));
  for (let i = 0; i < valid.length; i += EXPO_PUSH_BATCH) {
    const batch = valid.slice(i, i + EXPO_PUSH_BATCH);
    try {
      const res = await options.fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        },
        body: JSON.stringify(batch.map((m) => ({ sound: "default", channelId: "default", ...m }))),
      });
      const body = (await res.json().catch(() => ({}))) as { data?: PushTicket[]; errors?: { message?: string }[] };
      if (!res.ok) {
        outcome.errors.push(`HTTP ${res.status}: ${body.errors?.map((e) => e.message).join("; ") ?? ""}`);
        continue;
      }
      (body.data ?? []).forEach((ticket, index) => {
        if (ticket.status === "ok") outcome.sent++;
        else if (ticket.details?.error === "DeviceNotRegistered") outcome.deadTokens.push(batch[index].to);
        else outcome.errors.push(ticket.message ?? ticket.details?.error ?? "unknown push error");
      });
    } catch (error) {
      outcome.errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return outcome;
}
