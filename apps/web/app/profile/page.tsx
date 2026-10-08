"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";

/** "My profile": a creator's public page, a member's dashboard, or sign-in. */
export default function ProfilePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/auth/login");
    else if (user.role === "CREATOR") router.replace(`/@${user.username}`);
    else router.replace("/dashboard");
  }, [user, isLoading, router]);

  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center text-xs text-zinc-500 font-mono light:text-slate-500">{t("profile.loading")}</div>
  );
}
