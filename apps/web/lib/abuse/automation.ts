import { HttpError } from "../http";

/**
 * Simple signs of an automated client, read from the request headers. None is proof — a determined bot sends a
 * browser's headers — but they are free to check and stop the cheap scripts that make most of the noise:
 *
 * - `no-user-agent`: every browser and the Orochia app send one;
 * - `scripted-client`: an HTTP library's default (curl, wget, python-requests, Go, Java, Scrapy…);
 * - `headless-browser`: HeadlessChrome, PhantomJS.
 *
 * Used two ways: sign-up refuses them outright ({@link refuseAutomation}); sensitive actions give them a quarter of the
 * per-IP limit (`limitAction`, lib/rate-limit.ts). Bursts are what the short-window limits catch; actions that need
 * JavaScript (JSON bodies, the sign-up form token, the bot challenge) stop plain form posts.
 */
export type AutomationSignal = "no-user-agent" | "scripted-client" | "headless-browser";

const SCRIPTED =
  /\b(?:curl|wget|python-requests|python-urllib|python-httpx|aiohttp|httpie|go-http-client|java\/\d|apache-httpclient|libwww-perl|scrapy|node-fetch|axios|postmanruntime|insomnia)\b/i;
const HEADLESS = /\b(?:headlesschrome|phantomjs|slimerjs)\b/i;

export function automationSignals(headers: Headers): AutomationSignal[] {
  const ua = headers.get("user-agent")?.trim() ?? "";
  const signals: AutomationSignal[] = [];
  if (!ua) signals.push("no-user-agent");
  else {
    if (SCRIPTED.test(ua)) signals.push("scripted-client");
    if (HEADLESS.test(ua)) signals.push("headless-browser");
  }
  return signals;
}

export const automationScore = (headers: Headers) => automationSignals(headers).length;

/** Sign-up and other actions only a person does: an automated-looking client is refused (403 AUTOMATION_REFUSED). */
export function refuseAutomation(headers: Headers) {
  const signals = automationSignals(headers);
  if (signals.length > 0) {
    console.warn(`abuse: automated client refused (${signals.join(", ")})`);
    throw new HttpError(403, "This request looks automated. Use the Orochia website or app.", { code: "AUTOMATION_REFUSED" });
  }
}
