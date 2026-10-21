"use client";

import { Badge } from "@krizaka/ui/badge";
import { IconButton } from "@krizaka/ui/button";
import { ThemeToggle } from "@krizaka/ui/theme";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

import { BuildBadge } from "@/console/components/BuildBadge";
import type { AdminIdentity } from "@/console/lib/account";

/** The console has no i18n: English labels, fixed (one operator, desktop). */
const THEME_LABEL = { dark: "Theme: dark — switch to light", "light": "Theme: light — follow the system", system: "Theme: system — switch to dark" };

export function AdminHeader({ admin }: { admin: AdminIdentity }) {
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  };
  const initials = admin.displayName.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border-default bg-surface-1/80 px-6 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <Badge tone="success">Administrator</Badge>
        <BuildBadge />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-tr from-accent to-accent-2 text-xs font-bold text-on-accent">
          {initials}
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-xs font-bold leading-none text-fg">{admin.displayName}</p>
          <p className="mt-0.5 font-mono text-[10px] text-fg-accent">{admin.email}</p>
        </div>
        <ThemeToggle label={(mode) => THEME_LABEL[mode]} variant="secondary" className="ml-2 h-9 w-9" />
        <IconButton label="Sign out" variant="secondary" onClick={signOut} className="h-9 w-9">
          <LogOut className="h-4 w-4" />
        </IconButton>
      </div>
    </header>
  );
}
