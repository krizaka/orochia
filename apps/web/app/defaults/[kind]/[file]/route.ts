import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_AVATARS, DEFAULT_BANNERS } from "@/lib/presets";

export const dynamic = "force-static";

const AVATAR_FILES = new Set(DEFAULT_AVATARS.flatMap((p) => [`${p.id}-512.webp`, `${p.id}-256.webp`]));
const BANNER_FILES = new Set(DEFAULT_BANNERS.map((p) => `${p.id}.webp`));

/** True for a file the defaults really are (nothing else of the zone is ever reachable through this route). */
export function isDefaultFile(kind: string, file: string): boolean {
  return (kind === "avatars" && AVATAR_FILES.has(file)) || (kind === "banners" && BANNER_FILES.has(file));
}

/**
 * `/defaults/avatars/<id>-<size>.webp` and `/defaults/banners/<id>.webp`: the default pictures, read from the product's
 * storage zone (`public/defaults/`) through its pull zone with the app's own origin as Referer, and returned with a
 * year-long immutable cache. A browser, a native app (no Referer) and a crawler all get the same bytes from here.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ kind: string; file: string }> }) {
  const { kind, file } = await props.params;
  if (!isDefaultFile(kind, file)) return new NextResponse("Not found", { status: 404 });
  const host = process.env.MEDIA_CDN_HOSTNAME;
  if (!host) return new NextResponse("Media is not configured", { status: 503 });
  const upstream = await fetch(`https://${host}/public/defaults/${kind}/${file}`, { headers: { Referer: `${req.nextUrl.origin}/` }, cache: "force-cache" }).catch(() => null);
  if (!upstream?.ok) return new NextResponse("Not found", { status: upstream?.status === 404 ? 404 : 502 });
  return new NextResponse(upstream.body, { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
}
