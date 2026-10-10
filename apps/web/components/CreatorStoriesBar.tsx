"use client";

import { PlusIcon } from "@krizaka/icons";
import React, { Suspense, useState } from "react";

import { CreateStoryModal } from "@/components/CreateStoryModal";
import { StoryViewer } from "@/components/stories/StoryViewer";
import { useStoryAddress, useStoryRings } from "@/components/stories/useStories";
import { Avatar, cn, Skeleton } from "@/components/ui";
import { AVATAR_PLACEHOLDER, useAuth } from "@/lib/auth-context";
import { t } from "@/lib/i18n";
import { startOf } from "@/lib/story-player";

/**
 * The stories rail (Instagram-style): one ring per creator with live stories you may see — yours first, then unseen,
 * then seen — opening the story viewer (components/stories/StoryViewer.tsx) on the address `?story=<id>`. Everything
 * comes from /api/stories, already filtered and signed for you; a view counts once.
 */
export function CreatorStoriesBar() {
  return (
    <Suspense fallback={null}>
      <StoriesRail />
    </Suspense>
  );
}

function StoriesRail() {
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { rings, load, patchStory } = useStoryRings();
  const { position, open, go, close } = useStoryAddress(rings);

  const isCreator = user?.role === "CREATOR" || user?.role === "ADMIN";
  if (rings !== null && rings.length === 0 && !isCreator) return null;

  return (
    <>
      <CreateStoryModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={load} />

      <div className="relative mb-8 overflow-hidden rounded-2xl border border-border-default bg-surface-1/60 p-3 sm:p-4 backdrop-blur-xl max-w-full">
        <div className="flex items-center gap-3.5 sm:gap-5 overflow-x-auto scrollbar-none py-1 px-1 overscroll-x-contain touch-pan-x">
          {isCreator && (
            <button type="button" onClick={() => setIsCreateOpen(true)} className="group flex shrink-0 flex-col items-center gap-1.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent">
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 border-dashed border-accent/60 bg-accent/10 transition-transform group-hover:scale-105">
                <PlusIcon size={22} className="text-accent transition-transform duration-300 group-hover:rotate-90" />
              </div>
              <span className="text-[11px] font-semibold text-fg-secondary">{t("stories.add")}</span>
            </button>
          )}

          {rings === null &&
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} shape="rect" className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16" />)}

          {rings?.map((r) => (
            <button
              key={r.creatorId}
              type="button"
              onClick={() => r.stories.length > 0 && open(r.stories[startOf(r.stories)].id)}
              aria-label={r.isOwn ? t("stories.yours") : t("stories.profile.openOf", { name: r.displayName })}
              className="group flex shrink-0 flex-col items-center gap-1.5 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="relative p-0.5 rounded-2xl transition-transform group-hover:scale-105 active:scale-95">
                <div
                  className={cn(
                    "absolute inset-0 rounded-2xl",
                    r.allSeen ? "bg-surface-3" : "bg-linear-to-tr from-accent via-accent-2 to-accent-2 shadow-xs shadow-accent/20"
                  )}
                />
                <div className="relative h-14 w-14 sm:h-16 sm:w-16 overflow-hidden rounded-[14px] bg-surface-1 p-0.5">
                  <Avatar src={r.avatarUrl || AVATAR_PLACEHOLDER} fallback={r.displayName.charAt(0)} className="h-full w-full rounded-[12px]" />
                </div>
                {r.isOwn && r.stories.some((s) => s.state === "processing") && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface-3 px-1.5 py-px text-[9px] font-semibold text-fg-secondary">
                    {t("stories.processing")}
                  </span>
                )}
              </div>
              <span className="max-w-[72px] truncate text-[11px] font-medium text-fg group-hover:text-accent">
                {r.isOwn ? t("stories.yours") : r.displayName}
              </span>
            </button>
          ))}

          {rings?.length === 0 && isCreator && <p className="px-2 text-xs text-fg-muted">{t("stories.emptyCreator")}</p>}
        </div>
      </div>

      {rings && (
        <StoryViewer
          rings={rings}
          position={position}
          onNavigate={go}
          onClose={() => {
            close();
            void load();
          }}
          onStoryChange={patchStory}
          onRemoved={() => {
            close();
            void load();
          }}
        />
      )}
    </>
  );
}
