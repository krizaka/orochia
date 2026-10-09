import { describe, expect, it } from "vitest";
import { EXPO_PUSH_URL, isExpoPushToken, sendExpoPush, type PushMessage } from "./index";

const token = (n: number) => `ExponentPushToken[abcdefgh${n}]`;
const message = (n: number): PushMessage => ({ to: token(n), title: "New follower", body: "Ada follows you", data: { path: "/@ada" } });

describe("expo push", () => {
  it("recognises Expo tokens and nothing else", () => {
    expect(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("fcm:abc")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
  });

  it("batches by 100, sends with the access token, and reports dead tokens", async () => {
    const calls: { url: string; body: unknown[]; auth?: string }[] = [];
    const fetch = async (url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
      const body = JSON.parse(init.body) as PushMessage[];
      calls.push({ url, body, auth: init.headers.Authorization });
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: body.map((m) => (m.to === token(3) ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: "t" })) }),
      };
    };
    const outcome = await sendExpoPush(Array.from({ length: 150 }, (_, i) => message(i)), { fetch, accessToken: "secret" });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(EXPO_PUSH_URL);
    expect(calls[0].body).toHaveLength(100);
    expect(calls[0].auth).toBe("Bearer secret");
    expect(outcome.sent).toBe(149);
    expect(outcome.deadTokens).toEqual([token(3)]);
  });

  it("never throws: a network failure is an error in the outcome", async () => {
    const outcome = await sendExpoPush([message(1)], { fetch: async () => Promise.reject(new Error("offline")) });
    expect(outcome).toEqual({ sent: 0, deadTokens: [], errors: ["offline"] });
  });

  it("drops what is not an Expo token without calling the service", async () => {
    let called = false;
    const outcome = await sendExpoPush([{ ...message(1), to: "nope" }], { fetch: async () => ((called = true), { ok: true, status: 200, json: async () => ({}) }) });
    expect(called).toBe(false);
    expect(outcome.sent).toBe(0);
  });
});
