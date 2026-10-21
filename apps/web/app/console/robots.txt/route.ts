/** The operator console is never indexed: robots.txt shuts the door (and every response says noindex — next.config.mjs). */
export function GET() {
  return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "public, max-age=300" } });
}
