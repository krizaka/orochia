"use client";

import React from "react";

import { useI18n } from "@/lib/i18n-client";

import { PresenceAvatar, presenceLabel } from "./PresenceAvatar";
import type { OnlinePerson } from "./types";

/**
 * "Online now": the people of the circle in front of a screen (then away), one tap to their conversation. Hidden when
 * nobody is — never a placeholder.
 */
export function OnlineNow({ people, onOpen }: { people: OnlinePerson[]; onOpen: (username: string) => void }) {
  const { t } = useI18n();
  if (people.length === 0) return null;
  return (
    <section aria-labelledby="online-now" className="border-b border-border-default px-4 py-3">
      <h2 id="online-now" className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-secondary">
        {t("inbox.onlineNow")}
      </h2>
      <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {people.map((p) => (
          <li key={p.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onOpen(p.username)}
              aria-label={`${p.displayName}, ${presenceLabel(t, p.presence) ?? ""}`}
              className="flex w-14 flex-col items-center gap-1 rounded-xl p-1 transition-colors hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <PresenceAvatar src={p.avatarUrl} name={p.displayName} presence={p.presence} size="lg" />
              <span className="w-full truncate text-center text-[10px] text-fg-secondary">{p.displayName}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
