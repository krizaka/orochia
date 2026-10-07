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
    const env = { MAILGUN_API_KEY: "key", MAILGUN_DOMAIN: "mg.orochia.com" } as unknown as NodeJS.ProcessEnv;
    expect(await sendMail({ to: "a@example.com, b@example.com", subject: "Hi", text: "Body" }, env)).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.mailgun.net/v3/mg.orochia.com/messages");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("api:key").toString("base64")}`);
    expect((init.body as FormData).getAll("to")).toEqual(["a@example.com", "b@example.com"]);
    expect((init.body as FormData).get("from")).toBe("Orochia <no-reply@mg.orochia.com>");
  });

  it("reports a refusal without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Forbidden", { status: 401 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const env = { MAILGUN_API_KEY: "key", MAILGUN_DOMAIN: "mg.orochia.com" } as unknown as NodeJS.ProcessEnv;
    expect(await sendMail({ to: "a@example.com", subject: "s", text: "t" }, env)).toBe(false);
  });
});
