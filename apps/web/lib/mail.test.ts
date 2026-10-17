import { afterEach, describe, expect, it, vi } from "vitest";

import { sendMail } from "./mail";

afterEach(() => vi.unstubAllGlobals());

describe("mail", () => {
  it("sends nothing without configuration", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendMail({ to: "a@example.com", subject: "s", text: "t" }, {} as NodeJS.ProcessEnv)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts to the domain's Mailgun endpoint with basic auth and every recipient", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const env = { NODE_ENV: "production", MAIL_PROVIDER: "mailgun", MAIL_API_KEY: "key", MAIL_DOMAIN: "mg.orochia.com" } as unknown as NodeJS.ProcessEnv;
    expect(await sendMail({ to: "a@example.com, b@example.com", subject: "Hi", text: "Body" }, env)).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.mailgun.net/v3/mg.orochia.com/messages");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("api:key").toString("base64")}`);
    expect((init.body as FormData).getAll("to")).toEqual(["a@example.com", "b@example.com"]);
    expect((init.body as FormData).get("from")).toBe("Orochia <no-reply@mg.orochia.com>");
  });

  it("adds the HTML part next to the plain text", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const env = { NODE_ENV: "production", MAIL_PROVIDER: "mailgun", MAIL_API_KEY: "key", MAIL_DOMAIN: "mg.orochia.com" } as unknown as NodeJS.ProcessEnv;
    expect(await sendMail({ to: "a@example.com", subject: "Hi", text: "Body", html: "<p>Body</p>" }, env)).toBe(true);
    const form = fetch.mock.calls[0][1].body as FormData;
    expect(form.get("text")).toBe("Body");
    expect(form.get("html")).toBe("<p>Body</p>");
  });

  it("uses Resend when MAIL_PROVIDER=resend", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const env = { NODE_ENV: "production", MAIL_PROVIDER: "resend", MAIL_API_KEY: "re_key", MAIL_FROM: "Orochia <no-reply@mg.orochia.com>" } as unknown as NodeJS.ProcessEnv;
    expect(await sendMail({ to: "a@example.com", subject: "Hi", text: "Body", replyTo: "r@example.com" }, env)).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_key");
    expect(JSON.parse(init.body)).toEqual({ from: "Orochia <no-reply@mg.orochia.com>", to: ["a@example.com"], subject: "Hi", text: "Body", reply_to: "r@example.com" });
  });

  it("sends nothing when MAIL_PROVIDER is unset, unknown, or its key is missing", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const env of [
      { NODE_ENV: "production", MAIL_API_KEY: "key", MAIL_DOMAIN: "mg.orochia.com" },
      { NODE_ENV: "production", MAIL_PROVIDER: "postmark", MAIL_API_KEY: "key" },
      { NODE_ENV: "production", MAIL_PROVIDER: "resend" },
      { NODE_ENV: "production", MAIL_PROVIDER: "mailgun", MAIL_API_KEY: "key" },
    ]) {
      expect(await sendMail({ to: "a@example.com", subject: "s", text: "t" }, env as unknown as NodeJS.ProcessEnv)).toBe(false);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("never delivers outside production unless MAIL_DELIVERY=on", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const env = { NODE_ENV: "development", MAIL_PROVIDER: "resend", MAIL_API_KEY: "re_key" } as unknown as NodeJS.ProcessEnv;
    expect(await sendMail({ to: "seed@example.com", subject: "s", text: "t" }, env)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(await sendMail({ to: "me@example.com", subject: "s", text: "t" }, { ...env, MAIL_DELIVERY: "on" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("reports a refusal without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status: 401 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const env = { NODE_ENV: "production", MAIL_PROVIDER: "mailgun", MAIL_API_KEY: "key", MAIL_DOMAIN: "mg.orochia.com" } as unknown as NodeJS.ProcessEnv;
    expect(await sendMail({ to: "a@example.com", subject: "s", text: "t" }, env)).toBe(false);
  });
});
