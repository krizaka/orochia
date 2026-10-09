import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { db, users } from "@orochia/db";
import { eq } from "drizzle-orm";
import { platformFeePercent } from "@orochia/payments";
import { getCurrentUser } from "@/lib/auth";
import { UploadDropzone } from "@/components/UploadDropzone";
import { BecomeCreatorCard } from "@/components/BecomeCreatorCard";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload a video" };

/** Upload: signed-in, verified creators only (the same rule the upload-session API enforces). */
export default async function CreatorUploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/creator/upload");
  const [account] = await db.select({ role: users.role, isVerified: users.isVerified }).from(users).where(eq(users.id, user.id)).limit(1);
  const isCreator = account?.role === "CREATOR" || account?.role === "ADMIN";

  if (!isCreator) return <BecomeCreatorCard />;
  if (!account?.isVerified) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
          <ShieldCheck className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-fg">{t("auth.becomeCreator.pendingTitle")}</h1>
        <p className="mt-2 text-sm text-fg-secondary">{t("auth.becomeCreator.pendingBody")}</p>
        <Link href="/legal/2257" className="mt-6 inline-block rounded-xl bg-accent px-6 py-2.5 text-xs font-bold text-white">
          {t("auth.becomeCreator.pendingCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <UploadDropzone platformFeePercent={platformFeePercent()} />
    </div>
  );
}
