"use client";

import React from "react";

import { Chip, cn, Switch } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";
import { applyPreset, CATEGORIES, type Category, eventsOf, matrixFromOff, offFromMatrix, type Preset, presetOf, PRESETS, SECURITY_CATEGORY } from "@/lib/notification-matrix";

/**
 * What reaches you: five categories × the app (bell and push) and e-mail, with three presets. The security row is shown
 * and cannot be switched off. The two "off" lists are the stored truth; a switch changes one category on one channel and
 * leaves the finer choices made elsewhere alone.
 */
export function NotificationMatrix({
  isCreator,
  inAppOff,
  emailsOff,
  emailDisabled,
  onChange,
}: {
  isCreator: boolean;
  inAppOff: string[];
  emailsOff: string[];
  /** E-mail is globally off (frequency "never"): the e-mail column is inert. */
  emailDisabled: boolean;
  onChange: (next: { inAppOff?: string[]; emailsOff?: string[] }) => void;
}) {
  const { t } = useI18n();
  const matrix = matrixFromOff(inAppOff, emailsOff);
  const preset = presetOf(matrix);
  const categories = CATEGORIES.filter((c) => isCreator || c !== "earnings");

  const set = (category: Category, channel: "app" | "email", on: boolean) => {
    const list = channel === "app" ? inAppOff : emailsOff;
    const events = eventsOf(category) as string[];
    const next = on ? list.filter((e) => !events.includes(e)) : [...new Set([...list, ...events])];
    onChange(channel === "app" ? { inAppOff: next } : { emailsOff: next });
  };

  const choose = (p: Preset) => onChange(offFromMatrix(applyPreset(p)));

  return (
    <div>
      <Chip.Group type="single" required label={t("settings.notifications.presets.label")} value={preset ?? ""} onValueChange={(v) => v && choose(v as Preset)}>
        {PRESETS.map((p) => (
          <Chip key={p} value={p}>
            {t(`settings.notifications.presets.${p}`)}
          </Chip>
        ))}
      </Chip.Group>
      <p className="mt-2 text-[11px] text-fg-secondary">{preset ? t(`settings.notifications.presets.${preset}Hint`) : t("settings.notifications.presets.custom")}</p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border-default">
        <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-border-default bg-surface-2 px-4 py-2.5 text-[10px] font-bold text-fg-secondary sm:grid-cols-[minmax(0,1fr)_96px_96px]">
          <span />
          <span className="text-center">{t("settings.notifications.inApp")}</span>
          <span className="text-center">{t("settings.notifications.byEmail")}</span>
        </div>
        {categories.map((c) => {
          const locked = c === SECURITY_CATEGORY;
          const name = t(`settings.notifications.categories.${c}`);
          return (
            <div key={c} className={cn("grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-border-subtle px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_96px_96px]")}>
              <span>
                <span className="block text-sm font-semibold text-fg">{name}</span>
                <span className="block text-[11px] text-fg-secondary">{locked ? t("settings.notifications.securityNote") : t(`settings.notifications.categoryHints.${c as Exclude<Category, "account">}`)}</span>
              </span>
              <span className="flex justify-center">
                <Switch checked={locked || matrix[c].app} disabled={locked} label={`${name} — ${t("settings.notifications.inApp")}`} onCheckedChange={(on) => set(c, "app", on)} />
              </span>
              <span className="flex justify-center">
                <Switch checked={locked || matrix[c].email} disabled={locked || emailDisabled} label={`${name} — ${t("settings.notifications.byEmail")}`} onCheckedChange={(on) => set(c, "email", on)} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
