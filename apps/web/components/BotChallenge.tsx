"use client";

import React, { useEffect, useRef } from "react";

import { t } from "@/lib/i18n";

/**
 * Cloudflare Turnstile (lib/abuse/turnstile.ts): with an "Invisible" site key nobody sees anything unless Cloudflare
 * really doubts — then a single check appears here. `onToken` receives the response to send with the form (null when
 * it expires or fails); a token is good for one submission, so the form remounts this (`key`) after a refusal.
 */
export interface PublicChallenge {
  provider: "turnstile";
  siteKey: string;
}

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile unavailable"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function BotChallenge({ challenge, action, onToken }: { challenge: PublicChallenge | null; action: string; onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!challenge || !box.current) return;
    let widget: string | null = null;
    let live = true;
    loadTurnstile()
      .then(() => {
        if (!live || !box.current || !window.turnstile) return;
        widget = window.turnstile.render(box.current, {
          sitekey: challenge.siteKey,
          action,
          appearance: "interaction-only",
          theme: document.documentElement.classList.contains("light") ? "light" : "dark",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        });
      })
      // The server decides what a missing token means (sign-up refuses it, with a clear message).
      .catch(() => callback.current(null));
    return () => {
      live = false;
      if (widget && window.turnstile) window.turnstile.remove(widget);
    };
  }, [challenge, action]);

  if (!challenge) return null;
  return <div ref={box} className="flex min-h-0 justify-center" aria-label={t("auth.register.challenge")} />;
}

/** The public challenge settings (GET /api/auth/challenge): null while loading or when none is configured. */
export function useBotChallenge(): PublicChallenge | null {
  const [challenge, setChallenge] = React.useState<PublicChallenge | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/auth/challenge", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { challenge: PublicChallenge | null } | null) => live && setChallenge(body?.challenge ?? null))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  return challenge;
}
