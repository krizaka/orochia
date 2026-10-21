"use client";

import { Button } from "@krizaka/ui/button";
import { Field, Input, Select, Textarea } from "@krizaka/ui/field";
import React, { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/app/console/actions";

/** The parameters of one platform, as Orochia's admin API returns them. */
export interface AppVersionRecord {
  platform: string;
  minSupportedVersion: string;
  latestVersion: string;
  updateOverride: "none" | "soft" | "force" | null;
  storeUrl: string | null;
  maintenanceOn: boolean;
  maintenanceMessage: Record<string, string>;
  message: Record<string, string>;
  contractMin: number;
  contractMax: number;
  contractSunset: string | null;
  flags: Record<string, boolean | number | string>;
  revision: number;
  updatedAt: string;
  updatedBy: string;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="primary" loading={pending}>
      Publish
    </Button>
  );
}

/**
 * One platform's version parameters: the minimum a build must have, the latest published, the update mode, the store
 * page, maintenance, the API contract range (the previous one keeps working until its sunset), the feature flags and
 * the words the app shows in both languages. A change is published with a reason; Orochia bounds it, records who and why,
 * and the apps see it within the cache's seconds.
 */
export function AppVersionForm({ record, action }: { record: AppVersionRecord; action: (state: ActionState, form: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, null);
  const id = (name: string) => `${record.platform}-${name}`;
  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="platform" value={record.platform} />
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">Versions</legend>
        <Field.Root>
          <Field.Label htmlFor={id("min")}>Minimum supported version</Field.Label>
          <Input id={id("min")} name="minSupportedVersion" defaultValue={record.minSupportedVersion} required pattern="v?\d+(\.\d+){0,2}.*" className="font-mono" />
          <Field.Hint>Older builds get 426 and must update.</Field.Hint>
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor={id("latest")}>Latest version</Field.Label>
          <Input id={id("latest")} name="latestVersion" defaultValue={record.latestVersion} required pattern="v?\d+(\.\d+){0,2}.*" className="font-mono" />
          <Field.Hint>Builds below it are invited to update.</Field.Hint>
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor={id("override")}>Update mode</Field.Label>
          <Select id={id("override")} name="updateOverride" defaultValue={record.updateOverride ?? ""}>
            <option value="">Automatic (from the versions)</option>
            <option value="soft">Soft for everyone</option>
            <option value="force">Force for everyone</option>
            <option value="none">No prompt</option>
          </Select>
          <Field.Hint>The panic switch. The minimum still holds.</Field.Hint>
        </Field.Root>
      </fieldset>

      <Field.Root>
        <Field.Label htmlFor={id("store")}>Store page</Field.Label>
        <Input id={id("store")} name="storeUrl" type="url" defaultValue={record.storeUrl ?? ""} placeholder="https://apps.apple.com/app/id…" />
        <Field.Hint>https only. Where “Update” goes.</Field.Hint>
      </Field.Root>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Words</legend>
        <Field.Root>
          <Field.Label htmlFor={id("msg-en")}>Update message (English)</Field.Label>
          <Textarea id={id("msg-en")} name="message.en" defaultValue={record.message.en ?? ""} maxLength={500} />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor={id("msg-fr")}>Message de mise à jour (français)</Field.Label>
          <Textarea id={id("msg-fr")} name="message.fr" defaultValue={record.message.fr ?? ""} maxLength={500} />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor={id("mnt-en")}>Maintenance message (English)</Field.Label>
          <Textarea id={id("mnt-en")} name="maintenanceMessage.en" defaultValue={record.maintenanceMessage.en ?? ""} maxLength={500} />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor={id("mnt-fr")}>Message de maintenance (français)</Field.Label>
          <Textarea id={id("mnt-fr")} name="maintenanceMessage.fr" defaultValue={record.maintenanceMessage.fr ?? ""} maxLength={500} />
        </Field.Root>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" name="maintenanceOn" defaultChecked={record.maintenanceOn} className="h-4 w-4" />
        Maintenance on — the apps show the maintenance screen instead of the app
      </label>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="sr-only">API contract</legend>
        <Field.Root>
          <Field.Label htmlFor={id("cmin")}>Oldest contract served</Field.Label>
          <Input id={id("cmin")} name="contractMin" type="number" min={1} defaultValue={record.contractMin} required className="font-mono" />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor={id("cmax")}>Newest contract</Field.Label>
          <Input id={id("cmax")} name="contractMax" type="number" min={1} defaultValue={record.contractMax} required className="font-mono" />
        </Field.Root>
        <Field.Root>
          <Field.Label htmlFor={id("sunset")}>Sunset of the older ones</Field.Label>
          <Input id={id("sunset")} name="contractSunset" type="date" defaultValue={record.contractSunset ?? ""} />
          <Field.Hint>Announced in the Sunset header.</Field.Hint>
        </Field.Root>
      </fieldset>

      <Field.Root>
        <Field.Label htmlFor={id("flags")}>Feature flags (JSON)</Field.Label>
        <Textarea id={id("flags")} name="flags" defaultValue={JSON.stringify(record.flags)} className="font-mono" />
      </Field.Root>

      <Field.Root>
        <Field.Label htmlFor={id("reason")}>Reason</Field.Label>
        <Input id={id("reason")} name="reason" required minLength={3} maxLength={500} placeholder="Why this change — it goes to the audit trail" />
      </Field.Root>

      <div className="flex flex-wrap items-center gap-3">
        <Submit />
        {state && (
          <span role="status" className={state.ok ? "text-xs text-fg-success" : "text-xs text-fg-danger"}>
            {state.ok ? state.message : state.error}
          </span>
        )}
        <span className="ml-auto font-mono text-[11px] text-fg-secondary">
          revision {record.revision} · {record.updatedBy}
        </span>
      </div>
    </form>
  );
}
