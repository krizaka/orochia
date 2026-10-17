import { androidFingerprints, assetLinks } from "@/lib/app-links";

export const dynamic = "force-dynamic";

/** Android App Links: the package and the signing certificate that may open this site's links. */
export function GET() {
  const body = assetLinks(androidFingerprints(process.env.APP_ANDROID_CERT_SHA256));
  if (!body) return new Response("Not found", { status: 404 });
  return Response.json(body, { headers: { "cache-control": "public, max-age=300" } });
}
