"use client";

import dynamic from "next/dynamic";
import React from "react";

import { Skeleton } from "@/components/ui";

/**
 * The stories rail on the home, loaded after the page: the rail and its viewer carry the HLS player (hls.js, the
 * heaviest script of the app), which must not hold back the first paint of the home. Its place is kept by a skeleton of
 * the same height.
 */
export const StoriesRail = dynamic(() => import("@/components/CreatorStoriesBar").then((m) => m.CreatorStoriesBar), {
  ssr: false,
  loading: () => (
    <div aria-hidden className="mb-8 flex gap-4 overflow-hidden rounded-2xl border border-border-default bg-surface-1/60 p-3 sm:p-4">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} shape="rect" className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16" />
      ))}
    </div>
  ),
});
