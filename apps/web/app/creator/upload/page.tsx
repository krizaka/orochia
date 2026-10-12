import { platformFeePercent } from "@orochia/payments";
import { redirect } from "next/navigation";
import React from "react";

import { StorageMeter } from "@/components/dashboard/StorageMeter";
import { UploadDropzone } from "@/components/UploadDropzone";
import { CREATOR_APPLY_PATH, CREATOR_UPLOAD_PATH, signInHref } from "@/lib/creator-journey";
import { storageOverview } from "@/lib/storage-usage";
import { getViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Upload a video" };

/**
 * Upload: verified creators only (the same rule the upload-session API enforces). Anyone else is sent to their next
 * step — a member or a pending creator to the creator application of their account (docs/CREATOR_ONBOARDING.md).
 */
export default async function CreatorUploadPage() {
  const { user, state } = await getViewer();
  if (!user) redirect(signInHref(CREATOR_UPLOAD_PATH));
  if (state !== "creator") redirect(CREATOR_APPLY_PATH);

  // The space left, before choosing a file (a configuration error leaves the gauge to the client, which hides it).
  const storage = await storageOverview(user.id).catch(() => null);
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {storage && <StorageMeter initial={storage} compact className="mb-6" />}
      <UploadDropzone platformFeePercent={platformFeePercent()} />
    </div>
  );
}
