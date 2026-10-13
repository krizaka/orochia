import { NextRequest, NextResponse } from "next/server";

import { publicChallenge } from "@/lib/abuse/turnstile";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** JSON safe inside a <script> element. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/**
 * The bot challenge for the native app's sign-up: Turnstile has no native SDK, so the app shows this page in a WebView
 * — the same Cloudflare widget, site key and server check as the web form (lib/abuse/turnstile.ts, failing closed).
 * The page posts `{ type: "challenge", token }` to the app (`window.ReactNativeWebView`); `off: true` when no challenge
 * is configured, `interactive` while Cloudflare asks the person something (the app makes room for it).
 */
export function GET(req: NextRequest) {
  const challenge = publicChallenge();
  const theme = req.nextUrl.searchParams.get("theme") === "light" ? "light" : "dark";
  const config = challenge ? { siteKey: challenge.siteKey, theme, action: "signup" } : null;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t("auth.register.challenge")}</title>
<style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center;padding:4px}</style>
<script>
var config = ${scriptJson(config)};
function send(message) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: "challenge" }, message))); }
function start() {
  window.turnstile.render("#box", {
    sitekey: config.siteKey, action: config.action, theme: config.theme, appearance: "interaction-only",
    callback: function (token) { send({ token: token }); },
    "expired-callback": function () { send({ token: null }); },
    "error-callback": function () { send({ token: null, error: true }); },
    "before-interactive-callback": function () { send({ interactive: true }); },
    "after-interactive-callback": function () { send({ interactive: false }); }
  });
}
if (!config) send({ token: null, off: true });
</script>
${config ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=start&render=explicit" async defer onerror="send({ token: null, error: true })"></script>' : ""}
</head><body><div id="box"></div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
