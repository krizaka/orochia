import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * lib/push.ts — the server end of mobile push: the delivery gate, what is sent to the Expo Push Service (title, text,
 * the path the tap opens, the Android channel the app creates, a sound), the dead tokens forgotten, and a push that
 * never throws. The database and the push service are stand-ins; `@krizaka/push`'s real `isExpoPushToken` is used.
 */
const store = vi.hoisted(() => ({
  devices: [] as { token: string }[],
  deleted: [] as unknown[],
  upserts: [] as { values: Record<string, unknown>; set: Record<string, unknown> }[],
  selectFails: false,
}));
const sent = vi.hoisted(() => ({
  calls: [] as { messages: Record<string, unknown>[]; accessToken?: string }[],
  outcome: { sent: 0, deadTokens: [] as string[], errors: [] as string[] },
}));

vi.mock("@orochia/db", () => ({
  pushDevices: { token: "token", userId: "userId" },
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          if (store.selectFails) throw new Error("connection lost");
          return store.devices;
        },
      }),
    }),
    delete: () => ({
      where: async (condition: unknown) => {
        store.deleted.push(condition);
      },
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: async ({ set }: { set: Record<string, unknown> }) => {
          store.upserts.push({ values, set });
        },
      }),
    }),
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  inArray: (column: unknown, values: unknown) => ({ inArray: [column, values] }),
  and: (...conditions: unknown[]) => ({ and: conditions }),
}));
vi.mock("@krizaka/push", async (original) => ({
  ...(await original<typeof import("@krizaka/push")>()),
  sendExpoPush: vi.fn(async (messages: Record<string, unknown>[], options: { accessToken?: string }) => {
    sent.calls.push({ messages, accessToken: options.accessToken });
    return sent.outcome;
  }),
}));

const { pushDeliveryEnabled, pushToUser, registerDevice, unregisterDevice } = await import("./push");

const TOKEN_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";
const TOKEN_B = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]";
const message = { title: "Elena tipped you", body: "Elena sent you $5.00", path: "/dashboard?tab=earnings" };

beforeEach(() => {
  store.devices = [];
  store.deleted = [];
  store.upserts = [];
  store.selectFails = false;
  sent.calls = [];
  sent.outcome = { sent: 0, deadTokens: [], errors: [] };
  vi.stubEnv("PUSH_DELIVERY", "on");
  vi.stubEnv("EXPO_ACCESS_TOKEN", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the delivery gate", () => {
  it("sends in production unless PUSH_DELIVERY=off, elsewhere only with PUSH_DELIVERY=on", () => {
    expect(pushDeliveryEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
    expect(pushDeliveryEnabled({ NODE_ENV: "production", PUSH_DELIVERY: "off" } as NodeJS.ProcessEnv)).toBe(false);
    expect(pushDeliveryEnabled({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe(false);
    expect(pushDeliveryEnabled({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(false);
    expect(pushDeliveryEnabled({ NODE_ENV: "development", PUSH_DELIVERY: "on" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("never reads the database nor calls the service when closed", async () => {
    vi.stubEnv("PUSH_DELIVERY", "off");
    store.selectFails = true; // would throw if read
    await pushToUser("u1", message);
    expect(sent.calls).toHaveLength(0);
  });
});

describe("pushToUser", () => {
  it("sends nothing to an account without a phone", async () => {
    await pushToUser("u1", message);
    expect(sent.calls).toHaveLength(0);
  });

  it("sends one message per phone: title, text, the path the tap opens", async () => {
    store.devices = [{ token: TOKEN_A }, { token: TOKEN_B }];
    await pushToUser("u1", message);
    expect(sent.calls).toHaveLength(1);
    const [first, second] = sent.calls[0].messages;
    expect(sent.calls[0].messages).toHaveLength(2);
    expect(first).toMatchObject({ to: TOKEN_A, title: message.title, body: message.body, data: { path: message.path } });
    expect(second.to).toBe(TOKEN_B);
  });

  it("rings: the Android channel the app creates (high importance) and the default sound", async () => {
    store.devices = [{ token: TOKEN_A }];
    await pushToUser("u1", message);
    expect(sent.calls[0].messages[0]).toMatchObject({ channelId: "default", sound: "default" });
  });

  it("passes the access token only when one is set (enhanced push security)", async () => {
    store.devices = [{ token: TOKEN_A }];
    await pushToUser("u1", message);
    expect(sent.calls[0].accessToken).toBeUndefined();
    vi.stubEnv("EXPO_ACCESS_TOKEN", "expo-token-for-tests");
    await pushToUser("u1", message);
    expect(sent.calls[1].accessToken).toBe("expo-token-for-tests");
  });

  it("forgets the tokens the service reports dead, and only those", async () => {
    store.devices = [{ token: TOKEN_A }, { token: TOKEN_B }];
    sent.outcome = { sent: 1, deadTokens: [TOKEN_B], errors: [] };
    await pushToUser("u1", message);
    expect(store.deleted).toEqual([{ inArray: ["token", [TOKEN_B]] }]);
  });

  it("deletes nothing when every token is alive", async () => {
    store.devices = [{ token: TOKEN_A }];
    sent.outcome = { sent: 1, deadTokens: [], errors: [] };
    await pushToUser("u1", message);
    expect(store.deleted).toHaveLength(0);
  });

  it("never throws: a failed service or database is logged, the action that notified goes on", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    store.devices = [{ token: TOKEN_A }];
    sent.outcome = { sent: 0, deadTokens: [], errors: ["HTTP 503"] };
    await expect(pushToUser("u1", message)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
    store.selectFails = true;
    await expect(pushToUser("u1", message)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
  });
});

describe("registerDevice / unregisterDevice", () => {
  it("refuses anything that is not an Expo push token, before storing it", async () => {
    expect(await registerDevice("u1", "not-a-token-at-all", "android")).toBe(false);
    expect(await registerDevice("u1", "fcm:abcdefghijklmnop", "android")).toBe(false);
    expect(store.upserts).toHaveLength(0);
  });

  it("stores a token, and moves it when the phone changes hands", async () => {
    expect(await registerDevice("u1", TOKEN_A, "android")).toBe(true);
    expect(await registerDevice("u2", TOKEN_A, "ios")).toBe(true);
    expect(store.upserts[0].values).toEqual({ userId: "u1", token: TOKEN_A, platform: "android" });
    expect(store.upserts[1].set).toMatchObject({ userId: "u2", platform: "ios" });
    expect(store.upserts[1].set.lastSeenAt).toBeInstanceOf(Date);
  });

  it("forgets a phone only for the account it belongs to", async () => {
    await unregisterDevice("u1", TOKEN_A);
    expect(store.deleted).toEqual([{ and: [{ eq: ["token", TOKEN_A] }, { eq: ["userId", "u1"] }] }]);
  });
});
