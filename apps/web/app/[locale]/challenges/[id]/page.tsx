import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React from "react";

import { ChallengeClient } from "@/components/challenges/ChallengeClient";
import { getI18n } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
  title: t("challenges.metaTitle"),
  robots: { index: false },
};
}

/** One challenge: its pot, its clock and what each person can do with it (the client keeps it current). */
export default async function ChallengePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  return (
    <div className="px-4 py-8 sm:px-6">
      <ChallengeClient id={id} />
    </div>
  );
}
