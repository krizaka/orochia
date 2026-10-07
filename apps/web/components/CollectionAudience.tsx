import React from "react";
import { Globe, Lock, UserCheck, UserPlus, Users, type LucideIcon } from "lucide-react";

export type CollectionVisibility = "PUBLIC" | "APPROVED_FOLLOWERS_ONLY" | "CONTACTS_ONLY" | "INVITED_ONLY" | "PRIVATE";

/** Who opens a collection, in the order the owner picks from. */
export const COLLECTION_AUDIENCES: { value: CollectionVisibility; label: string; hint: string; icon: LucideIcon }[] = [
  { value: "PRIVATE", label: "Only me", hint: "Nobody else sees it.", icon: Lock },
  { value: "INVITED_ONLY", label: "Invited", hint: "The people you invite and your lists.", icon: UserPlus },
  { value: "CONTACTS_ONLY", label: "Contacts", hint: "Your accepted contacts.", icon: Users },
  { value: "APPROVED_FOLLOWERS_ONLY", label: "Followers", hint: "The followers you approved.", icon: UserCheck },
  { value: "PUBLIC", label: "Everyone", hint: "Shown on your profile.", icon: Globe },
];

export function audienceOf(value: CollectionVisibility) {
  return COLLECTION_AUDIENCES.find((a) => a.value === value) ?? COLLECTION_AUDIENCES[0];
}

/** A compact badge naming who opens a collection. Each video in it keeps its own access rule. */
export function CollectionAudienceBadge({ visibility, className = "" }: { visibility: CollectionVisibility; className?: string }) {
  const { label, icon: Icon } = audienceOf(visibility);
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden /> {label}
    </span>
  );
}
