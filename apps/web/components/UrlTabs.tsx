"use client";

import { useRouter } from "next/navigation";
import React from "react";

import { Tabs } from "@/components/ui";
import { tabHref } from "@/lib/tab-href";

export interface UrlTab {
  id: string;
  label: string;
}

/**
 * The tab bar of a page whose panel the server renders: @krizaka/ui's `Tabs` (roving focus, arrow keys, one scroll
 * container), the open tab in the address (`?tab=`), so a link, a reload and the back button all land on it.
 */
export function UrlTabs({ label, path, tabs, active, defaultId = tabs[0]?.id ?? "" }: { label: string; path: string; tabs: UrlTab[]; active: string; defaultId?: string }) {
  const router = useRouter();
  return (
    <Tabs.Root value={active} onValueChange={(id) => router.push(tabHref(path, id, defaultId), { scroll: false })} className="mb-6">
      <Tabs.List aria-label={label} className="max-w-full overflow-y-hidden">
        {tabs.map((tab) => (
          <Tabs.Trigger key={tab.id} value={tab.id}>
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
