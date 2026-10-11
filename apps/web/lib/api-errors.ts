import { type MessageKey,t } from "./i18n";

/**
 * Words for the refusals the API answers with a stable `code` (quotas, rate limits, anti-bot): the API's own message is
 * English and technical, the UI says it in the app's language with what to do next. Unknown codes fall back to the
 * API's message, then to `fallback`. Safe on the client and the server.
 */
export interface ApiErrorBody {
  error?: string;
  code?: string;
  retryAfterSeconds?: number;
  quota?: { usedBytes?: number; limitBytes?: number | null };
}

const KNOWN = new Set([
  "FILE_TOO_LARGE",
  "VIDEO_TOO_LONG",
  "CREATOR_STORAGE_FULL",
  "CREATOR_MINUTES_FULL",
  "PLATFORM_STORAGE_FULL",
  "PLATFORM_MINUTES_FULL",
  "UPLOADS_PER_DAY",
  "CONCURRENT_UPLOADS",
  "STORAGE_LIMITS_UNAVAILABLE",
  "RATE_LIMITED",
  "LOGIN_LOCKED",
  "LOGIN_RATE_LIMITED",
  "AUTOMATION_REFUSED",
  "BOT_SUSPECTED",
  "FORM_TOKEN_MISSING",
  "FORM_TOKEN_INVALID",
  "FORM_TOO_FAST",
  "FORM_EXPIRED",
  "EMAIL_DOMAIN_REFUSED",
  "CHALLENGE_FAILED",
  "CHALLENGE_UNAVAILABLE",
  "MESSAGE_BLOCKED",
  "MESSAGE_YOU_BLOCKED",
  "MESSAGE_CONTACTS_ONLY",
]);

/** 1.4 GB, 820 MB, 12 KB. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(1)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}

/** "40 s", "3 min", "2 h" — a Retry-After in words. */
export function formatWait(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return t("apiErrors.wait.seconds", { count: s });
  if (s < 3600) return t("apiErrors.wait.minutes", { count: Math.ceil(s / 60) });
  return t("apiErrors.wait.hours", { count: Math.ceil(s / 3600) });
}

/** The message to show for an API refusal. `retryAfter` is the response's Retry-After header, when read. */
export function apiErrorMessage(body: ApiErrorBody | null | undefined, fallback: string, options: { retryAfter?: string | null; maxFileBytes?: number } = {}): string {
  const code = body?.code;
  if (code && KNOWN.has(code)) {
    const wait = formatWait(body?.retryAfterSeconds ?? (Number(options.retryAfter) || 60));
    const used = body?.quota?.usedBytes ?? 0;
    const limit = body?.quota?.limitBytes ?? null;
    return t(`apiErrors.${code}` as MessageKey, {
      wait,
      left: formatBytes(Math.max(0, (limit ?? 0) - used)),
      limit: limit === null ? "∞" : formatBytes(limit),
      max: options.maxFileBytes ? formatBytes(options.maxFileBytes) : "",
    });
  }
  return body?.error || fallback;
}

/** Reads a failed response's body and Retry-After into the message to show. */
export async function responseErrorMessage(res: Response, fallback: string, options: { maxFileBytes?: number } = {}): Promise<string> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  return apiErrorMessage(body, fallback, { retryAfter: res.headers.get("Retry-After"), ...options });
}
