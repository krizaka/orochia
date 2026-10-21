/* Two addresses, one app (epic krizaka/.github#119, krizaka-com AGENTS section 2.4). www.orochia.com is the public address
   (NEXT_PUBLIC_APP_URL). dev.orochia.com (APP_DEV_HOST) is the development address: every page goes to www with a 308; only
   what is called keeps serving there — the API (mobile app, auth, webhooks, the operator console's calls), /.well-known,
   /robots.txt (Disallow), the native bot-challenge page. The proxy's matcher already leaves those out; this decides the rest.
   Indexing stays what APP_SEARCH_INDEXING says (off: noindex on every response, robots Disallow): www is NOT opened to
   search engines here — that is a separate, explicit decision (AGENTS.md of krizaka-com, section 2.4). */
const bare = (host: string | null | undefined) => (host ?? "").trim().toLowerCase().replace(/:\d+$/, "");

export const isDevHost = (host: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean =>
  !!env.APP_DEV_HOST?.trim() && bare(host) === bare(env.APP_DEV_HOST);

const KEEPS = ["/api/", "/.well-known/", "/auth/native-challenge"];
const KEEPS_EXACT = ["/robots.txt", "/healthz"];

/** The www address a dev-host request goes to (308), or null when the dev host keeps serving it. Only GET and HEAD are pages. */
export function devRedirect(method: string, pathname: string, search: string, publicUrl: string): string | null {
  if (method !== "GET" && method !== "HEAD") return null;
  if (KEEPS_EXACT.includes(pathname) || KEEPS.some((p) => pathname.startsWith(p))) return null;
  return `${publicUrl.replace(/\/$/, "")}${pathname}${search}`;
}
