import { CreatorIcon } from "@krizaka/icons";
import { db, users } from "@orochia/db";
import { platformFeePercent } from "@orochia/payments";
import { eq } from "drizzle-orm";
import { Check, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import React from "react";

import { OpenCreatorSpaceButton } from "@/components/creator/OpenCreatorSpaceButton";
import { buttonVariants, cn, EmptyState, SectionBackdrop, Stepper } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { CREATOR_APPLY_PATH, CREATOR_STUDIO_PATH, signInHref, signUpHref } from "@/lib/creator-journey";
import { signupEnabled } from "@/lib/features";
import { getI18n } from "@/lib/i18n-server";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("creatorSpace.apply.metaTitle") };
}

/**
 * The creator application of the signed-in account (docs/CREATOR_ONBOARDING.md). One address for every step:
 * a visitor signs up first and comes back here; a member opens the creator space of *their* account (a role change,
 * never a new account); a pending creator reads the status of the 2257 review; a verified creator goes to the studio.
 */
export default async function CreatorApplyPage() {
  const { t } = await getI18n();
  const { user, state } = await getViewer();
  if (!user) {
    // Signed up but the e-mail is not confirmed yet: the verification gate (EmailVerificationGate) shows instead.
    if (await getSession()) return null;
    redirect(signupEnabled() ? signUpHref(CREATOR_APPLY_PATH) : signInHref(CREATOR_APPLY_PATH));
  }
  if (state === "creator") redirect(CREATOR_STUDIO_PATH);

  if (state === "suspended") {
    return (
      <div className="mx-auto max-w-lg px-4 py-24">
        <EmptyState bird="falcon" title={t("creatorSpace.apply.suspended.title")} description={t("creatorSpace.apply.suspended.body")} />
      </div>
    );
  }

  const [account] = await db.select({ email: users.email, dateOfBirth: users.dateOfBirth }).from(users).where(eq(users.id, user.id)).limit(1);
  const hasBirthDate = Boolean(account?.dateOfBirth);
  const pending = state === "creator-pending";
  const share = 100 - platformFeePercent();

  const accountStep = hasBirthDate
    ? { title: t("creatorSpace.apply.steps.account.title"), description: t("creatorSpace.apply.steps.account.body"), status: "done" as const }
    : {
        title: t("creatorSpace.apply.steps.accountMissing.title"),
        description: t("creatorSpace.apply.steps.accountMissing.body"),
        status: "current" as const,
        content: (
          <Link href="/me/settings#settings-profile" className={buttonVariants({ variant: "secondary", size: "sm", shape: "pill" })}>
            {t("creatorSpace.apply.addBirthDate")}
          </Link>
        ),
      };
  const steps = [
    accountStep,
    {
      title: t("creatorSpace.apply.steps.open.title"),
      description: t("creatorSpace.apply.steps.open.body"),
      status: pending ? ("done" as const) : hasBirthDate ? ("current" as const) : ("upcoming" as const),
      content: pending ? undefined : <OpenCreatorSpaceButton disabled={!hasBirthDate} />,
    },
    {
      title: t("creatorSpace.apply.steps.review.title"),
      description: t("creatorSpace.apply.steps.review.body", { email: account?.email ?? user.email }),
      status: pending ? ("current" as const) : ("upcoming" as const),
    },
    {
      title: t("creatorSpace.apply.steps.publish.title"),
      description: t("creatorSpace.apply.steps.publish.body", { share }),
      status: "upcoming" as const,
    },
  ];

  const lists = [
    {
      key: "before",
      icon: Clock,
      items: ["creatorSpace.apply.before.items.fan", "creatorSpace.apply.before.items.profile", "creatorSpace.apply.before.items.payout"],
    },
    {
      key: "after",
      icon: Check,
      items: ["creatorSpace.apply.after.items.upload", "creatorSpace.apply.after.items.earn", "creatorSpace.apply.after.items.badge"],
    },
  ] as const;

  return (
    <SectionBackdrop direction="down" aria-labelledby="creator-apply-title">
      <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-accent">
          <CreatorIcon size={16} nodeColor="var(--kz-accent-2)" /> {t("creatorSpace.apply.eyebrow")}
        </p>
        <h1 id="creator-apply-title" className="mt-2 font-display text-3xl font-black tracking-tight text-fg sm:text-4xl">
          {t(pending ? "creatorSpace.apply.pending.title" : "creatorSpace.apply.member.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-secondary">
          {pending ? t("creatorSpace.apply.pending.lead") : t("creatorSpace.apply.member.lead", { username: user.username })}
        </p>

        <div className="mt-8 rounded-3xl border border-border-default bg-surface-1/80 p-5 backdrop-blur-xl sm:p-7">
          <Stepper aria-label={t("creatorSpace.apply.steps.label")} steps={steps} />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {lists.map(({ key, icon: Icon, items }) => (
            <section key={key} aria-labelledby={`creator-apply-${key}`} className="rounded-3xl border border-border-default bg-surface-1/60 p-5">
              <h2 id={`creator-apply-${key}`} className="text-sm font-bold text-fg">
                {t(`creatorSpace.apply.${key}.title`)}
              </h2>
              <ul className="mt-3 space-y-2">
                {items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-fg-secondary">
                    <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", key === "after" ? "text-fg-success" : "text-fg-muted")} aria-hidden />
                    {t(item)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/me/settings#settings-profile" className={buttonVariants({ variant: "outline", size: "sm", shape: "pill" })}>
            {t("creatorSpace.apply.links.profile")}
          </Link>
          {pending && (
            <Link href="/me/earnings" className={buttonVariants({ variant: "outline", size: "sm", shape: "pill" })}>
              {t("creatorSpace.apply.links.payout")}
            </Link>
          )}
          <Link href="/legal/2257" className={buttonVariants({ variant: "ghost", size: "sm", shape: "pill" })}>
            {t("creatorSpace.apply.links.rules")}
          </Link>
        </div>
      </div>
    </SectionBackdrop>
  );
}
