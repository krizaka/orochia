"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import { Button, buttonClass } from "@/components/ui";
import { t } from "@/lib/i18n";
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
  const [open, setOpen] = useState(false);
  const text = label ?? t("challenge.start");
  if (!signedIn) {
    const next = creatorUsername ? `/@${creatorUsername}` : "/challenges";
    return (
      <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className={buttonClass({ variant, className: "kz-sheen" })}>
        <Flame className="h-4 w-4" aria-hidden /> {text}
      </Link>
    );
  }
  return (
    <>
      <Button variant={variant} className="kz-sheen" onClick={() => setOpen(true)} icon={<Flame className="h-4 w-4" />}>
        {text}
      </Button>
      {open && <ChallengeComposer open={open} onClose={() => setOpen(false)} isCreator={isCreator} initialKind={kind} creatorUsername={creatorUsername} />}
    </>
  );
}
