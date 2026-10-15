"use client";

import { useRouter } from "next/navigation";
import React from "react";

import { ChallengeComposer } from "./ChallengeComposer";

/** Opens the composer on the kind a card asked for (`/challenges?new=goal|dare|call`); closing leaves the address clean. */
export function ChallengeAutoStart({ kind, isCreator }: { kind: "GOAL" | "REQUEST" | "OPEN_CALL"; isCreator: boolean }) {
  const router = useRouter();
  return <ChallengeComposer open onClose={() => router.replace("/challenges")} isCreator={isCreator} initialKind={kind} />;
}
