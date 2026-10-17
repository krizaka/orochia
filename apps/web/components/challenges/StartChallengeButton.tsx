"use client";

import { Flame } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { Button, orochiaButton } from "@/components/ui";
import { useI18n } from "@/lib/i18n-client";

import { ChallengeComposer } from "./ChallengeComposer";

/** Opens the challenge composer — or, for a visitor, the sign-in page that comes back here. */
export function StartChallengeButton({
  signedIn,
  isCreator,
  kind,
  creatorUsername,
  label,
  variant = "primary",
}: {
  signedIn: boolean;
  isCreator: boolean;
  kind?: "GOAL" | "REQUEST" | "OPEN_CALL";
  creatorUsername?: string;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const text = label ?? t("challenge.start");
  // "primary" is Orochia's gradient call to action.
  const look = variant === "primary" ? "sensual" : "secondary";
  if (!signedIn) {
    const next = creatorUsername ? `/@${creatorUsername}` : "/challenges";
    return (
      <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className={orochiaButton({ variant: look, shape: "pill", className: "kz-sheen" })}>
        <Flame className="h-4 w-4" aria-hidden /> {text}
      </Link>
    );
  }
  return (
    <>
      <Button variant={variant} shimmer onClick={() => setOpen(true)}>
        <Flame className="h-4 w-4" aria-hidden />
        {text}
      </Button>
      {open && <ChallengeComposer open={open} onClose={() => setOpen(false)} isCreator={isCreator} initialKind={kind} creatorUsername={creatorUsername} />}
    </>
  );
}
