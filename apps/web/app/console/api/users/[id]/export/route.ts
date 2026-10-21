import { audit, currentAdmin } from "@/console/lib/account";
import { apiBaseUrl, serviceToken } from "@/console/lib/orochia";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Law 25 portability: streams an account's export from Orochia to the operator's browser, and logs that it was taken. */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });
  const { id } = await props.params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const res = await fetch(`${apiBaseUrl()}/api/admin/users/${id}/export`, { cache: "no-store", headers: { Authorization: `Bearer ${serviceToken()}` } });
  const requestIds = [res.headers.get("cf-ray") ?? ""].filter(Boolean);
  const body = (await res.json().catch(() => null)) as { export?: unknown } | null;
  if (!res.ok || !body?.export) {
    await audit("account export", id, res.status >= 400 && res.status < 500 ? "refused" : "failed", `Orochia answered ${res.status}`, { actor: admin.email, requestIds });
    return new Response("Export not available", { status: res.status === 404 ? 404 : 502 });
  }
  await audit("account exported", id, "ok", undefined, { actor: admin.email, requestIds });
  return new Response(JSON.stringify(body.export, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="orochia-account-${id}.json"`, "Cache-Control": "no-store" },
  });
}
