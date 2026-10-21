import { type AppConfigRecord, isPlatform, type Platform, validateRecord } from "@krizaka/app-config";
import { z } from "zod";

/**
 * The operator's side of the app-version contract (krizaka/.github#75): validate a publish, make the next revision. Pure —
 * the routes under `app/api/admin/app-config` read and write the two tables (`app_config`, append-only
 * `app_config_history`), and the console shows the history and rolls back by publishing an earlier revision again.
 */
const Text = z.record(z.string(), z.string().max(500));
const Flags = z.record(z.string(), z.union([z.boolean(), z.number(), z.string().max(200)]));

const Publish = z.object({
  minSupportedVersion: z.string().trim().min(1).max(32),
  latestVersion: z.string().trim().min(1).max(32),
  updateOverride: z.enum(["none", "soft", "force"]).nullable(),
  storeUrl: z.string().trim().url().max(500).nullable(),
  maintenanceOn: z.boolean(),
  maintenanceMessage: Text,
  message: Text,
  contractMin: z.number().int().min(1),
  contractMax: z.number().int().min(1),
  contractSunset: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  flags: Flags,
  reason: z.string().trim().min(3).max(500),
});

export type PublishBody = z.infer<typeof Publish>;
export type Parsed = { ok: true; platform: Platform; value: PublishBody } | { ok: false; status: number; message: string };

/** The platform of the address and the body of the publish, checked against the contract's own safety bounds. */
export function parsePublish(platform: string, body: unknown): Parsed {
  if (!isPlatform(platform)) return { ok: false, status: 404, message: "Unknown platform" };
  const parsed = Publish.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, message: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") };
  const problems = validateRecord({ ...nextRevision(undefined, parsed.data, "check", new Date(0), platform) });
  if (problems.length > 0) return { ok: false, status: 400, message: problems.join("; ") };
  return { ok: true, platform, value: parsed.data };
}

/** The record a publish produces: the current revision plus one (1 for the very first), by whom, when. */
export function nextRevision(current: AppConfigRecord | undefined, value: PublishBody, by: string, now: Date, platform: Platform = current?.platform as Platform): AppConfigRecord {
  const { reason: _reason, ...parameters } = value;
  return { ...parameters, platform, flags: parameters.flags, revision: (current?.revision ?? 0) + 1, updatedAt: now.toISOString(), updatedBy: by };
}
