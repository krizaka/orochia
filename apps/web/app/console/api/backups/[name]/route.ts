import { currentAdmin } from "@/console/lib/account";
import { apiBaseUrl, serviceToken } from "@/console/lib/orochia";

export const dynamic = "force-dynamic";

/** Streams a database backup from Orochia to the operator's browser (the service token never leaves the server). */
export async function GET(_req: Request, props: { params: Promise<{ name: string }> }) {
  if (!(await currentAdmin())) return new Response("Unauthorized", { status: 401 });
  const { name } = await props.params;
  const res = await fetch(`${apiBaseUrl()}/api/admin/platform/backups/${encodeURIComponent(name)}?download=1`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${serviceToken()}` },
  });
  if (!res.ok || !res.body) return new Response("Backup not available", { status: res.status === 404 ? 404 : 502 });
  return new Response(res.body, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": res.headers.get("content-disposition") ?? `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
