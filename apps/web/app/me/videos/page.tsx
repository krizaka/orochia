"use client";

import { useRouter } from "next/navigation";
import React, { useEffect } from "react";

import { StorageMeter } from "@/components/dashboard/StorageMeter";
import { VideoManager } from "@/components/dashboard/VideoManager";
import { useMeData } from "@/components/me/MeData";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

export default function MeVideos() {
  const { user } = useAuth();
  const { data, reload } = useMeData();
  const router = useRouter();
  const allowed = user?.role === "CREATOR" || user?.role === "ADMIN";
  useEffect(() => {
    if (user && !allowed) router.replace("/me");
  }, [user, allowed, router]);
  if (!allowed) return null;
  return data ? (
    <div className="flex flex-col gap-6">
      <StorageMeter compact />
      <VideoManager videos={data.uploads} onChange={() => void reload()} />
    </div>
  ) : (
    <Skeleton shape="rect" className="h-48 rounded-2xl" />
  );
}
