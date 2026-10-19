export const dynamic = "force-dynamic";

/** Liveness for the platform's health checks: the only path outside the IP gate, and it says nothing but "ok". */
export function GET() {
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}
