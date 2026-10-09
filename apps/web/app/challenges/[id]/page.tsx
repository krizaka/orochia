import React from "react";
import { notFound } from "next/navigation";
import { ChallengeClient } from "@/components/challenges/ChallengeClient";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export const metadata = {
  title: t("challenges.metaTitle"),
  robots: { index: false },
};

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
