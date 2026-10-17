"use client";

import { Globe, Lock, type LucideIcon,UserCheck, UserPlus, Users } from "lucide-react";
import React from "react";

import { Badge } from "@/components/ui";
import type { Translator } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n-client";

export type CollectionVisibility = "PUBLIC" | "APPROVED_FOLLOWERS_ONLY" | "CONTACTS_ONLY" | "INVITED_ONLY" | "PRIVATE";

/** Who opens a collection, in the order the owner picks from. */
const AUDIENCES: { value: CollectionVisibility; icon: LucideIcon }[] = [
  { value: "PRIVATE", icon: Lock },
  { value: "INVITED_ONLY", icon: UserPlus },
  { value: "CONTACTS_ONLY", icon: Users },
  { value: "APPROVED_FOLLOWERS_ONLY", icon: UserCheck },
  { value: "PUBLIC", icon: Globe },
];
export const collectionAudiences = (t: Translator) =>
  AUDIENCES.map((a) => ({
    ...a,
    label: t(`collectionAudience.${a.value}.label`),
    hint: t(`collectionAudience.${a.value}.hint`),
  }));

export function audienceOf(t: Translator, value: CollectionVisibility) {
  const all = collectionAudiences(t);
  return all.find((a) => a.value === value) ?? all[0];
}

/** A compact badge naming who opens a collection (@krizaka/ui's Badge). Each video in it keeps its own access rule. */
export function CollectionAudienceBadge({ visibility, className }: { visibility: CollectionVisibility; className?: string }) {
  const { t } = useI18n();
  const { label, icon: Icon } = audienceOf(t, visibility);
  return (
    <Badge className={className}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden /> {label}
    </Badge>
  );
}
