/**
 * Deployment switches, read at request time (never inlined at build): `AUTH_SIGNUP_ENABLED` (default false) opens
 * the sign-up form and its API. A development deployment stays closed to newcomers; existing accounts still sign in.
 */
import { HttpError } from "./http";

export function signupEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AUTH_SIGNUP_ENABLED?.trim().toLowerCase() === "true";
}

/** The stable code a client (web, mobile app) acts on when sign-up is closed. */
export const SIGNUP_DISABLED_CODE = "signup_disabled";

export function assertSignupEnabled(): void {
  if (!signupEnabled()) {
    throw new HttpError(403, "Sign-ups are closed while Orochia is in development.", { code: SIGNUP_DISABLED_CODE });
  }
}
