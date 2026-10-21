"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { audit, currentAdmin } from "@/console/lib/account";
import { outcomeOf } from "@/console/lib/audit-outcome";
import { moderationBody } from "@/console/lib/conversation-moderation";
import { ApiError, orochia } from "@/console/lib/orochia";
import { collectRequestIds } from "@/console/lib/request-ids";

/**
 * Operator decisions. Each action calls an Orochia admin endpoint and returns its outcome to the confirmation dialog
 * that sent it (components/ConfirmDialog.tsx): `ok`, or the API's error message — a refusal never crashes the screen.
 */

export type ActionState = { ok: boolean; error?: string; message?: string; at: number } | null;

async function attempt(paths: string[], run: () => Promise<string | void>, log?: { action: string; target?: string | null; detail?: string }): Promise<ActionState> {
  const actor = (await currentAdmin())?.email ?? null;
  const calls = await collectRequestIds(async () => {
    try {
      return { message: await run() };
    } catch (error) {
      return { error };
    }
  });
  const outcome = calls.value;
  if ("error" in outcome) {
    unstable_rethrow(outcome.error);
    if (log) await audit(log.action, log.target ?? null, outcomeOf(outcome.error), outcome.error instanceof Error ? outcome.error.message : String(outcome.error), { actor, requestIds: calls.ids });
    return { ok: false, error: outcome.error instanceof ApiError ? outcome.error.message : "Something went wrong. Try again.", at: Date.now() };
  }
  if (log) await audit(log.action, log.target ?? null, "ok", log.detail ?? outcome.message ?? undefined, { actor, requestIds: calls.ids });
  for (const p of paths) revalidatePath(p);
  return { ok: true, message: outcome.message || undefined, at: Date.now() };
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Moves a content report through triage. */
export async function updateReport(_: ActionState, form: FormData) {
  return attempt(["/moderation", "/"], async () => {
    await orochia(`/api/admin/reports/${text(form, "id")}`, { method: "PATCH", body: JSON.stringify({ status: text(form, "status") }) });
  }, { action: `report → ${text(form, "status")}`, target: text(form, "id") });
}

/** Acts on a reported conversation: removes a message, removes a member of a group, or closes the group. */
export async function moderateConversation(_: ActionState, form: FormData) {
  const action = text(form, "action");
  return attempt(["/moderation"], async () => {
    await orochia(`/api/admin/conversations/${text(form, "conversationId")}/moderate`, { method: "POST", body: JSON.stringify(moderationBody(action, text(form, "target"))) });
  }, { action: `conversation: ${action}`, target: text(form, "conversationId"), detail: text(form, "reason") });
}

/** Records the outcome of a creator's 2257 review. */
export async function setCreatorVerified(_: ActionState, form: FormData) {
  return attempt(["/compliance", "/creators", "/"], async () => {
    await orochia(`/api/admin/creators/${text(form, "id")}`, { method: "PATCH", body: JSON.stringify({ isVerified: text(form, "isVerified") === "true" }) });
  }, { action: text(form, "isVerified") === "true" ? "creator approved (2257)" : "creator uploads suspended", target: text(form, "id") });
}

/** Advances a payout request (settling needs the transfer reference, failing needs a reason). */
export async function updatePayout(_: ActionState, form: FormData) {
  const status = text(form, "status");
  const note = text(form, "reason");
  return attempt(["/treasury", "/"], async () => {
    await orochia(`/api/admin/payouts/${text(form, "id")}`, {
      method: "PATCH",
      body: JSON.stringify({ status, ...(status === "SETTLED" ? { txHashOrReference: note } : {}), ...(status === "FAILED" ? { failureReason: note } : {}) }),
    });
  }, { action: `payout → ${status}`, target: text(form, "id"), detail: note });
}

/** Takes a video down with a recorded reason (DMCA, terms, a confirmed report) — cancelling its auction — or restores it. */
export async function moderateVideo(_: ActionState, form: FormData) {
  const action = text(form, "action");
  return attempt(["/catalogue", "/moderation", "/auctions", "/"], async () => {
    await orochia(`/api/admin/videos/${text(form, "id")}`, { method: "PATCH", body: JSON.stringify(action === "remove" ? { action, reason: text(form, "reason") } : { action }) });
  }, { action: action === "remove" ? "video taken down" : "video restored", target: text(form, "id"), detail: text(form, "reason") });
}

/** Suspends (cancelling their open auctions) or reinstates an account, or changes its role. */
export async function manageUser(_: ActionState, form: FormData) {
  const action = text(form, "action");
  const body = action === "suspend" ? { action, reason: text(form, "reason") } : action === "set-role" ? { action, role: text(form, "role") } : { action };
  return attempt(["/users", "/creators", "/auctions"], async () => {
    await orochia(`/api/admin/users/${text(form, "id")}`, { method: "PATCH", body: JSON.stringify(body) });
  }, { action: action === "set-role" ? `role → ${text(form, "role")}` : `account ${action}`, target: text(form, "id"), detail: text(form, "reason") });
}

/** Ends every session of an account (a lost phone) without suspending it: the person signs in again. */
export async function endUserSessions(_: ActionState, form: FormData) {
  return attempt(["/users"], async () => {
    await orochia(`/api/admin/users/${text(form, "id")}/sessions`, { method: "DELETE" });
  }, { action: "sessions ended", target: text(form, "id") });
}

/** Cancels an auction with a recorded reason; the leading bid's credits go back to its bidder. */
export async function cancelAuction(_: ActionState, form: FormData) {
  return attempt(["/auctions", "/"], async () => {
    await orochia(`/api/admin/auctions/${text(form, "id")}`, { method: "DELETE", body: JSON.stringify({ reason: text(form, "reason") }) });
  }, { action: "auction cancelled", target: text(form, "id"), detail: text(form, "reason") });
}

/** Backs the database up now, into private storage. */
export async function backupDatabase(_: ActionState) {
  return attempt(["/platform"], async () => {
    const { backup } = await orochia<{ backup: { name: string; rows: number } }>("/api/admin/platform/backups", { method: "POST" });
    return `Backup ${backup.name} written (${backup.rows.toLocaleString("en-US")} rows).`;
  }, { action: "database backup" });
}

/** Deletes a backup file. */
export async function deleteBackup(_: ActionState, form: FormData) {
  return attempt(["/platform"], async () => {
    await orochia(`/api/admin/platform/backups/${encodeURIComponent(text(form, "name"))}`, { method: "DELETE" });
  }, { action: "backup deleted", target: text(form, "name") });
}

/** Factory reset: (backup,) wipe, rebuild from the migrations, keep this operator and the owner. */
export async function factoryReset(_: ActionState, form: FormData) {
  return attempt(["/", "/platform"], async () => {
    const result = await orochia<{ migrationsApplied: number; backup: { name: string } | null }>("/api/admin/platform/reset", {
      method: "POST",
      body: JSON.stringify({ confirm: text(form, "phrase"), backup: form.get("backup") === "on" }),
    });
    return `Database rebuilt (${result.migrationsApplied} migration${result.migrationsApplied === 1 ? "" : "s"})${result.backup ? ` — backup ${result.backup.name}` : ""}.`;
  }, { action: "factory reset", detail: form.get("backup") === "on" ? "with backup" : "without backup" });
}

/** Reconciles Orochia's storage counters with Bunny now (lists the Stream library; nothing is deleted). */
export async function reconcileStorage(_: ActionState) {
  return attempt(["/storage"], async () => {
    const { result } = await orochia<{ result: { libraryVideos: number; updatedRows: number; orphanVideos: number; missingVideos: number; released: number } }>("/api/admin/storage", { method: "POST" });
    return `Reconciled ${result.libraryVideos} Bunny video${result.libraryVideos === 1 ? "" : "s"}: ${result.updatedRows} row(s) corrected, ${result.missingVideos} missing at Bunny, ${result.orphanVideos} orphan(s)${result.released ? `, ${result.released} held upload(s) released` : ""}.`;
  }, { action: "storage reconciled with Bunny" });
}

/** Embeds the public videos that have no vector yet, through Orazaka (the scheduler does it every ten minutes). */
export async function syncExplorer(_: ActionState) {
  return attempt(["/explorer"], async () => {
    const { data } = await orochia<{ data: { summary: { configured: boolean; candidates: number; embedded: number; unchanged: number; failure: string | null } } }>("/api/admin/explorer/sync", { method: "POST" });
    const s = data.summary;
    if (!s.configured) throw new ApiError(409, "Orazaka is not configured on Orochia (AI_ENGINE_URL, AI_ENGINE_API_KEY).");
    if (s.failure) throw new ApiError(502, `Orazaka did not answer (${s.failure}); ${s.embedded} video(s) were indexed before it stopped.`);
    return `Indexed ${s.embedded} video${s.embedded === 1 ? "" : "s"} through Orazaka${s.unchanged ? `, ${s.unchanged} unchanged` : ""}.`;
  }, { action: "explorer indexed through Orazaka" });
}

/** Gives an account a storage plan of QUOTA_PLANS ("default" = the role's default); its held uploads go online if they fit. */
export async function setStoragePlan(_: ActionState, form: FormData) {
  const plan = text(form, "plan");
  return attempt(["/storage"], async () => {
    const result = await orochia<{ plan: string; released: { videos: string[]; stories: string[] } }>(`/api/admin/storage/${text(form, "id")}`, {
      method: "PATCH",
      body: JSON.stringify({ plan: plan === "default" ? null : plan }),
    });
    const released = result.released.videos.length + result.released.stories.length;
    return `Plan set to ${result.plan}${released ? ` — ${released} held upload(s) released` : ""}.`;
  }, { action: `storage plan → ${plan}`, target: text(form, "id") });
}

/** The apps' version parameters of one platform (krizaka/.github#75): published with a reason, bounded and audited by Orochia. */
export async function publishAppVersion(_: ActionState, form: FormData) {
  const platform = text(form, "platform");
  const language = (key: string) => ({ en: text(form, `${key}.en`), fr: text(form, `${key}.fr`) });
  const nonEmpty = (record: Record<string, string>) => Object.fromEntries(Object.entries(record).filter(([, value]) => value !== ""));
  return attempt(
    ["/app-versions"],
    async () => {
      let flags: unknown = {};
      try {
        flags = JSON.parse(text(form, "flags") || "{}");
      } catch {
        throw new ApiError(400, "Flags must be a JSON object, e.g. {\"voiceChat\": true}");
      }
      await orochia(`/api/admin/app-config/${platform}`, {
        method: "PUT",
        body: JSON.stringify({
          minSupportedVersion: text(form, "minSupportedVersion"),
          latestVersion: text(form, "latestVersion"),
          updateOverride: text(form, "updateOverride") || null,
          storeUrl: text(form, "storeUrl") || null,
          maintenanceOn: form.get("maintenanceOn") === "on",
          maintenanceMessage: nonEmpty(language("maintenanceMessage")),
          message: nonEmpty(language("message")),
          contractMin: Number(text(form, "contractMin")),
          contractMax: Number(text(form, "contractMax")),
          contractSunset: text(form, "contractSunset") || null,
          flags,
          reason: text(form, "reason"),
        }),
      });
      return `${platform} published`;
    },
    { action: `app versions → ${platform}`, target: platform, detail: text(form, "reason") },
  );
}

/** Publishes an earlier revision of a platform's version parameters again, as a new one. */
export async function rollbackAppVersion(_: ActionState, form: FormData) {
  const platform = text(form, "platform");
  const revision = Number(text(form, "revision"));
  return attempt(
    ["/app-versions"],
    async () => {
      await orochia(`/api/admin/app-config/${platform}/rollback`, { method: "POST", body: JSON.stringify({ revision, reason: text(form, "reason") }) });
      return `${platform} restored to revision ${revision}`;
    },
    { action: `app versions → ${platform} rollback`, target: `${platform}@${revision}`, detail: text(form, "reason") },
  );
}
