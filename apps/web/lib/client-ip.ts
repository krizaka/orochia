/**
 * The visitor's IP address, as far as this deployment can trust it. `X-Forwarded-For` is a list each proxy appends
 * to: its LEFT end is whatever the client sent (anyone can write `X-Forwarded-For: 1.2.3.4`), so a limit keyed on it
 * is a limit the attacker chooses. The address the last trusted proxy saw is read from the RIGHT:
 *
 * - `ABUSE_CLIENT_IP_HEADER` (e.g. `do-connecting-ip` on DigitalOcean App Platform, `cf-connecting-ip` behind Cloudflare):
 *   a header the edge sets and overwrites, read first when present;
 * - otherwise the entry `ABUSE_TRUSTED_PROXY_HOPS` (default 1: one proxy — App Platform, Caddy) from the right of
 *   `X-Forwarded-For`, then `X-Real-IP`;
 * - otherwise null (local development without a proxy).
 */
export function clientIp(headers: Headers, env: Record<string, string | undefined> = process.env): string | null {
  const custom = env.ABUSE_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (custom) {
    const value = headers.get(custom)?.split(",")[0]?.trim();
    if (value && isIp(value)) return value;
  }
  const hops = Math.max(1, Math.min(10, Number(env.ABUSE_TRUSTED_PROXY_HOPS) || 1));
  const chain = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const fromRight = chain[chain.length - hops];
  if (fromRight && isIp(fromRight)) return fromRight;
  const real = headers.get("x-real-ip")?.trim();
  if (real && isIp(real)) return real;
  return null;
}

/** The IP as a rate-limit key part: unknown addresses share one bucket (local development, misconfigured proxy). */
export const ipKey = (headers: Headers) => clientIp(headers) ?? "unknown";

const IPV4 = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-f:]+(?:%\w+)?$/i;
function isIp(value: string): boolean {
  return (IPV4.test(value) && value.split(".").every((n) => Number(n) <= 255)) || (value.includes(":") && IPV6.test(value));
}

/**
 * The IP a playback token is bound to, when `MEDIA_STREAM_TOKEN_BIND_IP=on` (off by default): Bunny then refuses the signed
 * URL from any other address, so a leaked link stops working elsewhere. Off by default because the address a viewer's
 * player uses can differ from the one the API saw (IPv4 vs IPv6, mobile networks switching mid-play, privacy relays),
 * which breaks playback for real viewers; turn it on once checked on the deployment's own traffic.
 */
export function playbackIp(headers: Headers, env: Record<string, string | undefined> = process.env): string | undefined {
  if (env.MEDIA_STREAM_TOKEN_BIND_IP?.trim().toLowerCase() !== "on") return undefined;
  return clientIp(headers, env) ?? undefined;
}
