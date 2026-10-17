"use client";

import React, { useState } from "react";

import { Chip, cn, Skeleton } from "@/components/ui";
import { t } from "@/lib/i18n";
import { familiesOf, type PresetAsset } from "@/lib/presets";

/**
 * The grid of ready-made pictures of the « Pick a picture » dialog: the families as chips (All first), the pictures of the
 * active family lazy-loaded, a skeleton while the list loads, the current picture marked. Presentational on purpose: the
 * dialog fetches the list and saves the choice.
 */
export function PresetPicker({
  kind,
  presets,
  loading,
  selectedId,
  onPick,
}: {
  kind: "avatar" | "banner";
  presets: PresetAsset[];
  loading: boolean;
  selectedId: string | null;
  onPick: (preset: PresetAsset) => void;
}) {
  const isAvatar = kind === "avatar";
  const [family, setFamily] = useState("all");
  const families = familiesOf(kind, presets);
  const shown = family === "all" ? presets : presets.filter((p) => p.family === family);
  const ratio = isAvatar ? "aspect-square" : "aspect-3/1";

  return (
    <div className="space-y-3">
      {!loading && families.length > 1 && (
        <Chip.Group type="single" required size="sm" label={t("settings.pictures.familiesLabel")} value={family} onValueChange={setFamily} className="flex-wrap">
          {["all", ...families].map((f) => (
            <Chip key={f} value={f}>
              {t(`settings.pictures.families.${f}` as "settings.pictures.families.all")}
            </Chip>
          ))}
        </Chip.Group>
      )}
      <div aria-busy={loading} className={cn("grid max-h-[60vh] gap-3 overflow-y-auto p-1", isAvatar ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
        {loading
          ? Array.from({ length: isAvatar ? 8 : 6 }, (_, i) => <Skeleton key={i} shape="rect" className={cn("h-auto rounded-2xl", ratio)} />)
          : shown.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === selectedId}
                onClick={() => onPick(p)}
                className={cn(
                  "overflow-hidden rounded-2xl ring-2 transition-all hover:scale-[1.03] hover:ring-ring focus-visible:outline-hidden focus-visible:ring-ring",
                  p.id === selectedId ? "ring-ring" : "ring-transparent"
                )}
              >
                <img src={p.thumbUrl} alt={p.alt.en} loading="lazy" decoding="async" className={cn("w-full bg-surface-3 object-cover", ratio)} />
              </button>
            ))}
      </div>
    </div>
  );
}
