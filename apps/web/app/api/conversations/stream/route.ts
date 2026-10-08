import { getSession } from "@/lib/auth";
import { sseResponse } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** Realtime Server-Sent Events (SSE) stream for instant direct messages and notifications. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  return sseResponse([`user:${session.id}`]);
}
